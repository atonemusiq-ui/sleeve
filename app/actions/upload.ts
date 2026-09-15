"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findDuplicateTrack } from "@/lib/fingerprint/check-duplicate";
import { isAllowedTrackPrice, trackPriceError } from "@/lib/trackPricing";
import { isValidGenre, isValidSubgenre, MAX_CUSTOM_TAG_LENGTH } from "@/lib/genres";
import { isAiDisclosureLevel, type AiDisclosureLevel } from "@/lib/aiDisclosure";
import { DEFAULT_TRACK_COVER_URL } from "@/lib/defaultCover";
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
  genre: string | null;
  subgenre: string | null;
  customTag: string | null;
  aiDisclosure: AiDisclosureLevel;
  explicit: boolean;
  rightsAttested: boolean;
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

  // Single-track pricing is a fixed $3/$4/$5 menu (see the price <select> in
  // UploadForm.tsx) — validated here too so a stale client or a direct call
  // can't slip an arbitrary price past the dropdown.
  if (!isAllowedTrackPrice(input.priceCents)) {
    return { status: "error", message: trackPriceError() };
  }

  // Genre is optional — an empty/null value is fine, but a non-empty one
  // must be either one of the fixed options (see lib/genres.ts and the
  // <select> in UploadForm.tsx) or a name an admin has approved off the
  // genre_suggestions queue (see app/actions/genres.ts and
  // app/admin/genres/page.tsx) — checked against the DB since that list
  // grows at runtime, unlike the fixed one.
  if (input.genre && !isValidGenre(input.genre)) {
    const { data: approved } = await admin
      .from("approved_genres")
      .select("id")
      .eq("name", input.genre)
      .maybeSingle();
    if (!approved) {
      return { status: "error", message: "That's not a recognized genre." };
    }
  }

  // Subgenre is only meaningful under a genre that has one — see
  // lib/genres.ts's SUBGENRES map — and, like genre, is unconstrained at the
  // DB layer so the list can grow without a migration.
  if (input.subgenre && !isValidSubgenre(input.genre, input.subgenre)) {
    return { status: "error", message: "That's not a recognized subgenre for this genre." };
  }

  const customTag = input.customTag?.trim() || null;
  if (customTag && customTag.length > MAX_CUSTOM_TAG_LENGTH) {
    return { status: "error", message: `Tag must be ${MAX_CUSTOM_TAG_LENGTH} characters or fewer.` };
  }

  // AI disclosure is a required 3-way choice (see lib/aiDisclosure.ts) — not
  // optional — and publishing requires confirming the rights attestation
  // shown next to it in UploadForm.tsx.
  if (!isAiDisclosureLevel(input.aiDisclosure)) {
    return { status: "error", message: "Please answer the AI disclosure question." };
  }
  if (!input.rightsAttested) {
    return {
      status: "error",
      message: "You must confirm you own the rights to this track before publishing.",
    };
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

  // Every track gets real artwork — the artist's own upload (including one
  // pulled straight out of the audio file's own tags, see
  // lib/extractEmbeddedArtwork.ts) if provided, otherwise the generic Fyby
  // cover, rather than showing no artwork at all on the storefront/embed
  // widget.
  const { error } = await admin.from("tracks").insert({
    artist_id: input.artistId,
    title: input.title,
    price_cents: input.priceCents,
    audio_path: input.audioPath,
    cover_url: input.coverUrl || DEFAULT_TRACK_COVER_URL,
    preview_url: input.previewUrl,
    audio_fingerprint: input.fingerprint,
    fingerprint_duration: Math.round(input.fingerprintDuration),
    genre: input.genre || null,
    subgenre: input.subgenre || null,
    custom_tag: customTag,
    ai_disclosure: input.aiDisclosure,
    explicit: input.explicit,
  });

  if (error) {
    return { status: "error", message: `Saving track failed: ${error.message}` };
  }

  revalidatePath("/dashboard");
  return { status: "published" };
}
