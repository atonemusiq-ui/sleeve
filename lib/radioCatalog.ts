// Server-only helpers behind the Fyby Radio API routes (app/api/radio/*).
// Kept out of lib/radio.ts because this imports the service-role client,
// which must never end up in a browser bundle.

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { RADIO_EXCLUDED_GENRES, buildStations, type Station } from "@/lib/radio";

export type RadioTrackRow = {
  id: string;
  title: string;
  price_cents: number;
  cover_url: string | null;
  audio_path: string | null;
  audio_url: string | null;
  genre: string | null;
  mood: string | null;
  explicit: boolean | null;
  ai_disclosure: string | null;
  created_at: string;
  artist_id: string;
  artists: {
    id: string;
    is_active: boolean;
    created_at: string | null;
    profiles: { display_name: string } | null;
  } | null;
  // Set by fetchRadioEligibleTracks from radio_premieres: when this track's
  // active Radio Premiere ends, or null if it has none right now.
  premiereEndsAt: string | null;
};

// Everything that may play on radio: the artist opted the track in, the
// artist page is active, an admin hasn't frozen it, it has audio, and it
// isn't a cover. This is the single gate every radio route goes through.
export async function fetchRadioEligibleTracks(): Promise<RadioTrackRow[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("tracks")
    .select(
      "id, title, price_cents, cover_url, audio_path, audio_url, genre, mood, explicit, ai_disclosure, created_at, artist_id, artists!inner ( id, is_active, created_at, profiles ( display_name ) )"
    )
    .eq("radio_opt_in", true)
    .eq("frozen", false)
    .eq("artists.is_active", true)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw new Error(error.message);

  // Active Radio Premieres right now (paid heavy rotation, lib/radio.ts).
  const nowIso = new Date().toISOString();
  const { data: premieres } = await admin
    .from("radio_premieres")
    .select("track_id, ends_at")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso);
  const premiereEnds = new Map<string, string>();
  for (const p of premieres ?? []) {
    const current = premiereEnds.get(p.track_id);
    if (!current || p.ends_at > current) premiereEnds.set(p.track_id, p.ends_at);
  }

  return ((data ?? []) as any[])
    .map((row) => {
      const artist = Array.isArray(row.artists) ? row.artists[0] : row.artists;
      const profiles = artist ? (Array.isArray(artist.profiles) ? artist.profiles[0] : artist.profiles) : null;
      return {
        ...row,
        artists: artist ? { ...artist, profiles: profiles ?? null } : null,
        premiereEndsAt: premiereEnds.get(row.id) ?? null,
      } as RadioTrackRow;
    })
    .filter((row) => (row.audio_path || row.audio_url) && !RADIO_EXCLUDED_GENRES.includes(row.genre ?? ""));
}

export function toRotationCandidate(t: RadioTrackRow) {
  return {
    id: t.id,
    artistId: t.artist_id,
    createdAt: t.created_at,
    artistCreatedAt: t.artists?.created_at ?? null,
    isPremiere: Boolean(t.premiereEndsAt),
  };
}

// The station a shared radio link should play: the track's genre station if
// it has one, otherwise Fresh on Fyby.
export function homeStationFor(track: RadioTrackRow, stations: Station[]): Station | undefined {
  return (
    stations.find((s) => s.kind === "genre" && s.value === track.genre) ??
    stations.find((s) => s.kind === "fresh")
  );
}

export function stationsFor(tracks: RadioTrackRow[]): Station[] {
  return buildStations(tracks.map((t) => ({ genre: t.genre, mood: t.mood })));
}

export function tracksForStation(tracks: RadioTrackRow[], station: Station): RadioTrackRow[] {
  if (station.kind === "genre") return tracks.filter((t) => t.genre === station.value);
  if (station.kind === "mood") return tracks.filter((t) => t.mood === station.value);
  return tracks;
}

// A full-song URL for the radio player. Short-lived on purpose; the player
// asks for a fresh one with every song. Not marked as a download, unlike the
// purchased-track route (app/api/stream/[trackId]/route.ts).
const RADIO_SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function radioAudioUrl(track: RadioTrackRow): Promise<string | null> {
  if (track.audio_path) {
    const admin = createServiceRoleClient();
    const { data } = await admin.storage
      .from("track-audio")
      .createSignedUrl(track.audio_path, RADIO_SIGNED_URL_TTL_SECONDS);
    return data?.signedUrl ?? null;
  }
  return track.audio_url;
}
