"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";
import { isAllowedTrackPrice, trackPriceError } from "@/lib/trackPricing";
import { isValidGenre, isValidSubgenre, MAX_CUSTOM_TAG_LENGTH } from "@/lib/genres";
import { isAiDisclosureLevel, type AiDisclosureLevel } from "@/lib/aiDisclosure";
import { isValidMood, RADIO_EXCLUDED_GENRES } from "@/lib/radio";
import { REMOVED_BY_ARTIST, isRemovedByArtist } from "@/lib/trackRemoval";

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
  const genre = (formData.get("genre") as string) || null;
  const subgenre = (formData.get("subgenre") as string) || null;
  const customTag = (formData.get("customTag") as string)?.trim() || null;
  const aiDisclosure = formData.get("aiDisclosure") as string;

  if (!title) return { error: "Title is required." };
  if (isNaN(priceCents) || !isAllowedTrackPrice(priceCents)) {
    return { error: trackPriceError() };
  }
  if (genre && !isValidGenre(genre)) {
    const admin = createServiceRoleClient();
    const { data: approved } = await admin.from("approved_genres").select("id").eq("name", genre).maybeSingle();
    if (!approved) return { error: "That's not a recognized genre." };
  }
  if (subgenre && !isValidSubgenre(genre, subgenre)) {
    return { error: "That's not a recognized subgenre for this genre." };
  }
  if (customTag && customTag.length > MAX_CUSTOM_TAG_LENGTH) {
    return { error: `Tag must be ${MAX_CUSTOM_TAG_LENGTH} characters or fewer.` };
  }
  if (!isAiDisclosureLevel(aiDisclosure)) {
    return { error: "Please answer the AI disclosure question." };
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

  const updatePayload: {
    title: string;
    price_cents: number;
    cover_url?: string;
    genre: string | null;
    subgenre: string | null;
    custom_tag: string | null;
    ai_disclosure: AiDisclosureLevel;
  } = {
    title,
    price_cents: priceCents,
    genre,
    subgenre,
    custom_tag: customTag,
    ai_disclosure: aiDisclosure,
  };
  if (coverUrl) updatePayload.cover_url = coverUrl;

  const { error } = await supabase.from("tracks").update(updatePayload).eq("id", trackId);
  if (error) return { error: `Saving changes failed: ${error.message}` };

  revalidatePath("/dashboard");
  revalidatePath("/");
  return {};
}

// Phase 10: turns Fyby Radio on or off for one of the artist's own tracks
// (TrackList.tsx's "Play on Fyby Radio" toggle), and sets its optional mood.
// Separate from updateTrack so flipping radio doesn't require opening the
// full edit form. Covers can't be opted in (see lib/radio.ts).
export async function setRadioSettings(
  trackId: string,
  radioOptIn: boolean,
  mood: string | null
): Promise<TrackActionResult> {
  if (mood && !isValidMood(mood)) return { error: "That's not a recognized mood." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };

  const { data: track } = await supabase
    .from("tracks")
    .select("artist_id, genre, radio_opt_in")
    .eq("id", trackId)
    .maybeSingle();
  if (!track) return { error: "Track not found." };

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("id", track.artist_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!artist) return { error: "That track doesn't belong to your account." };

  if (radioOptIn && RADIO_EXCLUDED_GENRES.includes(track.genre ?? "")) {
    return { error: "Covers can't play on Fyby Radio." };
  }

  const update: { radio_opt_in: boolean; mood: string | null; radio_opted_in_at?: string | null } = {
    radio_opt_in: radioOptIn,
    mood: mood || null,
  };
  if (radioOptIn && !track.radio_opt_in) update.radio_opted_in_at = new Date().toISOString();
  if (!radioOptIn) update.radio_opted_in_at = null;

  const { error } = await supabase.from("tracks").update(update).eq("id", trackId);
  if (error) return { error: `Saving radio settings failed: ${error.message}` };

  revalidatePath("/dashboard/catalog");
  return {};
}

export type RemoveTrackResult = { error?: string; outcome?: "deleted" | "taken_down" };

// The path inside a public bucket, from a public URL Supabase gave us
// (".../storage/v1/object/public/<bucket>/<path>"), or null if the URL isn't
// in that bucket (e.g. the default Fyby cover).
function publicPathIn(bucket: string, url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length));
}

// An artist removing one of their own songs (the Remove button in their
// catalog, TrackList.tsx, and on their own artist page).
//   - Never bought, licensed or premiered: deleted for good, files included.
//   - Has sales: it can't be deleted -- that would take it out of buyers'
//     libraries and erase the payout history -- so it's taken down instead:
//     hidden everywhere and no longer for sale, exactly like an admin freeze,
//     but marked as the artist's own removal so they can restore it.
// Either way it comes out of any album it was in, so the album keeps selling
// without it.
export async function removeTrack(trackId: string): Promise<RemoveTrackResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };

  const admin = createServiceRoleClient();
  const { data: track } = await admin
    .from("tracks")
    .select("id, title, artist_id, frozen, frozen_reason, audio_path, preview_url, cover_url, artists ( user_id )")
    .eq("id", trackId)
    .maybeSingle();
  if (!track || (track as any).artists?.user_id !== user.id) {
    return { error: "That song doesn't belong to your account." };
  }
  if (track.frozen && !isRemovedByArtist(track)) {
    return { error: "This song was taken down by Fyby. Contact support@getfyby.com about it." };
  }

  const [purchases, licenses, premieres] = await Promise.all([
    admin.from("purchases").select("id", { count: "exact", head: true }).eq("track_id", trackId),
    admin.from("license_purchases").select("id", { count: "exact", head: true }).eq("track_id", trackId),
    admin.from("radio_premieres").select("id", { count: "exact", head: true }).eq("track_id", trackId),
  ]);
  const hasHistory = (purchases.count ?? 0) + (licenses.count ?? 0) + (premieres.count ?? 0) > 0;

  await admin.from("album_tracks").delete().eq("track_id", trackId);

  if (hasHistory) {
    const { error } = await admin
      .from("tracks")
      .update({
        frozen: true,
        frozen_reason: REMOVED_BY_ARTIST,
        frozen_at: new Date().toISOString(),
        radio_opt_in: false,
        radio_opted_in_at: null,
      })
      .eq("id", trackId);
    if (error) return { error: `Removing the song failed: ${error.message}` };
  } else {
    const { error } = await admin.from("tracks").delete().eq("id", trackId);
    if (error) return { error: `Removing the song failed: ${error.message}` };

    // Best-effort file cleanup: the song is already gone, and an orphaned
    // file is a smaller problem than a removal that looks like it failed.
    const previewPath = publicPathIn("track-previews", track.preview_url);
    const coverPath = publicPathIn("track-covers", track.cover_url);
    await Promise.all([
      track.audio_path ? admin.storage.from("track-audio").remove([track.audio_path]) : null,
      previewPath ? admin.storage.from("track-previews").remove([previewPath]) : null,
      coverPath ? admin.storage.from("track-covers").remove([coverPath]) : null,
    ]);
  }

  revalidatePath("/dashboard/catalog");
  revalidatePath(`/artists/${track.artist_id}`);
  revalidatePath("/");
  return { outcome: hasHistory ? "taken_down" : "deleted" };
}

// Puts back a song the artist removed themselves (never one Fyby took down).
// It comes back on their page and for sale; albums it was in don't get it
// back automatically.
export async function restoreTrack(trackId: string): Promise<TrackActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };

  const admin = createServiceRoleClient();
  const { data: track } = await admin
    .from("tracks")
    .select("id, artist_id, frozen, frozen_reason, artists ( user_id )")
    .eq("id", trackId)
    .maybeSingle();
  if (!track || (track as any).artists?.user_id !== user.id) {
    return { error: "That song doesn't belong to your account." };
  }
  if (!isRemovedByArtist(track)) return { error: "Only songs you removed yourself can be restored." };

  const { error } = await admin
    .from("tracks")
    .update({ frozen: false, frozen_reason: null, frozen_at: null })
    .eq("id", trackId);
  if (error) return { error: `Restoring the song failed: ${error.message}` };

  revalidatePath("/dashboard/catalog");
  revalidatePath(`/artists/${track.artist_id}`);
  revalidatePath("/");
  return {};
}
