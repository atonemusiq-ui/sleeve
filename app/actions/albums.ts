"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AlbumActionResult = { error?: string };

// Tier suggestions ($7-10 for <=3 tracks, $15-20 for >=4 tracks — see
// AlbumManager.tsx) are a UI nudge only. Server-side we just sanity-bound the
// price so a stray typo (or a tampered request) can't create a $0 or
// four-figure "album" — an artist is still free to price outside the
// suggested tier.
const MIN_ALBUM_PRICE_CENTS = 100;
const MAX_ALBUM_PRICE_CENTS = 10000;

type OwnedArtist = { supabase: ReturnType<typeof createClient>; artistId: string };

async function getOwnedArtist(): Promise<OwnedArtist | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!artist) return { error: "No artist account found for your login." };

  return { supabase, artistId: artist.id };
}

// Confirms every trackId actually belongs to this artist — RLS ("artists
// manage their own album_tracks" in supabase/schema.sql) enforces this too,
// but checking here first turns a mismatched track into a clean error
// message instead of a raw RLS failure on the insert.
async function findUnownedTrack(
  supabase: ReturnType<typeof createClient>,
  artistId: string,
  trackIds: string[]
): Promise<string | null> {
  if (trackIds.length === 0) return "Choose at least one track.";

  const { data: tracks } = await supabase.from("tracks").select("id, artist_id").in("id", trackIds);
  const owned = new Set((tracks ?? []).filter((t) => t.artist_id === artistId).map((t) => t.id));
  const missing = trackIds.filter((id) => !owned.has(id));

  if (missing.length > 0) return "One or more selected tracks don't belong to your account.";
  return null;
}

// AlbumManager.tsx serializes the ordered track selection as a JSON array of
// track ids in a single hidden field — simpler than juggling N separate
// form fields for an artist who can reorder or resize the selection freely.
function parseTrackIds(formData: FormData): string[] {
  const raw = formData.get("trackIds") as string | null;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    // fall through to empty
  }
  return [];
}

function parsePriceCents(formData: FormData): number {
  return Math.round(parseFloat(formData.get("price") as string) * 100);
}

function priceRangeError(): string {
  return `Price must be between $${(MIN_ALBUM_PRICE_CENTS / 100).toFixed(2)} and $${(
    MAX_ALBUM_PRICE_CENTS / 100
  ).toFixed(2)}.`;
}

export async function createAlbum(formData: FormData): Promise<AlbumActionResult> {
  const title = (formData.get("title") as string)?.trim();
  const priceCents = parsePriceCents(formData);
  const trackIds = parseTrackIds(formData);

  if (!title) return { error: "Title is required." };
  if (isNaN(priceCents) || priceCents < MIN_ALBUM_PRICE_CENTS || priceCents > MAX_ALBUM_PRICE_CENTS) {
    return { error: priceRangeError() };
  }

  const owned = await getOwnedArtist();
  if ("error" in owned) return owned;
  const { supabase, artistId } = owned;

  const trackError = await findUnownedTrack(supabase, artistId, trackIds);
  if (trackError) return { error: trackError };

  const { data: album, error } = await supabase
    .from("albums")
    .insert({ artist_id: artistId, title, price_cents: priceCents })
    .select("id")
    .single();

  if (error || !album) return { error: error?.message ?? "Could not create album." };

  const albumTrackRows = trackIds.map((trackId, index) => ({
    album_id: album.id,
    track_id: trackId,
    track_order: index,
  }));

  const { error: linkError } = await supabase.from("album_tracks").insert(albumTrackRows);
  if (linkError) {
    // Don't leave a real-but-empty album behind if linking its tracks fails
    // partway through.
    await supabase.from("albums").delete().eq("id", album.id);
    return { error: `Could not link tracks to album: ${linkError.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/");
  return {};
}

export async function updateAlbum(formData: FormData): Promise<AlbumActionResult> {
  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  const priceCents = parsePriceCents(formData);
  const trackIds = parseTrackIds(formData);

  if (!title) return { error: "Title is required." };
  if (isNaN(priceCents) || priceCents < MIN_ALBUM_PRICE_CENTS || priceCents > MAX_ALBUM_PRICE_CENTS) {
    return { error: priceRangeError() };
  }

  const owned = await getOwnedArtist();
  if ("error" in owned) return owned;
  const { supabase, artistId } = owned;

  const { data: existingAlbum } = await supabase
    .from("albums")
    .select("id")
    .eq("id", id)
    .eq("artist_id", artistId)
    .maybeSingle();
  if (!existingAlbum) return { error: "Album not found." };

  const trackError = await findUnownedTrack(supabase, artistId, trackIds);
  if (trackError) return { error: trackError };

  const { error: updateError } = await supabase
    .from("albums")
    .update({ title, price_cents: priceCents })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  // Simplest correct way to change the track list/order on an edit: wipe and
  // re-insert rather than diffing — album_tracks rows have no identity worth
  // preserving across an edit (see supabase/schema.sql).
  await supabase.from("album_tracks").delete().eq("album_id", id);
  const albumTrackRows = trackIds.map((trackId, index) => ({
    album_id: id,
    track_id: trackId,
    track_order: index,
  }));
  const { error: linkError } = await supabase.from("album_tracks").insert(albumTrackRows);
  if (linkError) return { error: `Could not update album tracks: ${linkError.message}` };

  revalidatePath("/dashboard");
  revalidatePath("/");
  return {};
}

export async function deleteAlbum(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;

  const owned = await getOwnedArtist();
  if ("error" in owned) return;
  const { supabase, artistId } = owned;

  // album_tracks rows cascade-delete with the album (on delete cascade in
  // supabase/schema.sql); purchases.album_id is a plain nullable reference,
  // so past sales stay on the books even after the album listing is gone.
  await supabase.from("albums").delete().eq("id", id).eq("artist_id", artistId);
  revalidatePath("/dashboard");
  revalidatePath("/");
}
