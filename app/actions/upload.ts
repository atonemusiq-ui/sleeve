"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findDuplicateTrack } from "@/lib/fingerprint/check-duplicate";
import { revalidatePath } from "next/cache";

export type PublishTrackInput = {
  artistId: string;
  title: string;
  priceCents: number;
  audioPath: string;
  coverUrl: string | null;
  previewUrl: string | null;
  fingerprint: string;
  fingerprintDuration: number;
};

export type PublishTrackResult =
  | { status: "published" }
  | { status: "flagged"; similarity: number }
  | { status: "error"; message: string };

// The duplicate check has to happen server-side, in a server action the
// client can't skip — the storage uploads (audio/preview/cover) still happen
// directly from the browser (see app/dashboard/UploadForm.tsx), but the
// actual `tracks` row insert is gated behind this action rather than a
// direct client-side `.insert()`, so there's no path to publish a flagged
// duplicate by just not calling the check.
export async function publishTrack(input: PublishTrackInput): Promise<PublishTrackResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "You need to be logged in to publish a track." };
  }

  const admin = createServiceRoleClient();

  // Confirm the artist row actually belongs to this user — the client sends
  // artistId, so don't trust it blindly even though the later `tracks`
  // insert also has this behind RLS in the (unused-here) client path.
  const { data: artist } = await admin
    .from("artists")
    .select("id")
    .eq("id", input.artistId)
    .eq("user_id", user.id)
    .single();

  if (!artist) {
    return { status: "error", message: "That artist account doesn't match your login." };
  }

  const match = await findDuplicateTrack(admin, input.fingerprint);
  if (match) {
    await admin.from("flagged_uploads").insert({
      uploader_id: user.id,
      new_track_title: input.title,
      matched_track_id: match.trackId,
      similarity_score: Math.round(match.similarity * 1000) / 1000,
    });
    return { status: "flagged", similarity: match.similarity };
  }

  const { error } = await admin.from("tracks").insert({
    artist_id: input.artistId,
    title: input.title,
    price_cents: input.priceCents,
    audio_path: input.audioPath,
    cover_url: input.coverUrl,
    preview_url: input.previewUrl,
    audio_fingerprint: input.fingerprint,
    fingerprint_duration: Math.round(input.fingerprintDuration),
  });

  if (error) {
    return { status: "error", message: `Saving track failed: ${error.message}` };
  }

  revalidatePath("/dashboard");
  return { status: "published" };
}
