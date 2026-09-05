"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isAllowedTrackPrice, trackPriceError } from "@/lib/trackPricing";

export type TrackActionResult = { error?: string };

// Covers the title/price/cover edits on an already-published track
// (TrackList.tsx's inline edit form). The cover file itself still uploads
// directly from the browser to storage (server actions don't take File
// objects well) — this just takes the resulting URL and does the validated
// database write, replacing what used to be a direct, unvalidated client
// `.update()` call.
export async function updateTrack(formData: FormData): Promise<TrackActionResult> {
  const trackId = formData.get("trackId") as string;
  const title = (formData.get("title") as string)?.trim();
  const priceCents = Math.round(parseFloat(formData.get("price") as string) * 100);
  const coverUrl = (formData.get("coverUrl") as string) || null;

  if (!title) return { error: "Title is required." };
  if (isNaN(priceCents) || !isAllowedTrackPrice(priceCents)) {
    return { error: trackPriceError() };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };

  // Ownership check mirrors app/actions/contributors.ts's two-step lookup —
  // RLS ("artists can update their own tracks") enforces this too, but this
  // turns a mismatch into a clean message instead of a raw RLS failure.
  const { data: track } = await supabase.from("tracks").select("artist_id").eq("id", trackId).maybeSingle();
  if (!track) return { error: "Track not found." };

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("id", track.artist_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!artist) return { error: "That track doesn't belong to your account." };

  const updatePayload: { title: string; price_cents: number; cover_url?: string } = {
    title,
    price_cents: priceCents,
  };
  if (coverUrl) updatePayload.cover_url = coverUrl;

  const { error } = await supabase.from("tracks").update(updatePayload).eq("id", trackId);
  if (error) return { error: `Saving changes failed: ${error.message}` };

  revalidatePath("/dashboard");
  revalidatePath("/");
  return {};
}
