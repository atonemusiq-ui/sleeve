import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { FRESH_STATION_SLUG, RECENT_HISTORY_LIMIT, isRadioEnabled, pickNextTrack } from "@/lib/radio";
import {
  fetchRadioEligibleTracks,
  radioAudioUrl,
  stationsFor,
  toRotationCandidate,
  tracksForStation,
} from "@/lib/radioCatalog";

export const dynamic = "force-dynamic";

// GET /api/radio/next?station=<slug>&recent=<trackId,trackId,...>&session=<id>[&first=<trackId>]
//
// `first` (from a shared "playing on Fyby Radio" link, app/radio/[trackId])
// plays that exact song first if it's on this station; rotation takes over
// from the next song.
//
// Picks the next song for a station using the rotation rules in
// lib/radio.ts, returns its details plus a short-lived audio URL, and logs
// the play to radio_events. `recent` is the player's own play history, most
// recent first, so the server stays stateless.
export async function GET(req: Request) {
  if (!isRadioEnabled()) {
    return NextResponse.json({ error: "Fyby Radio isn't live yet." }, { status: 404 });
  }

  const url = new URL(req.url);
  const stationSlug = url.searchParams.get("station") || FRESH_STATION_SLUG;
  const recentTrackIds = (url.searchParams.get("recent") ?? "")
    .split(",")
    .filter(isUuid)
    .slice(0, RECENT_HISTORY_LIMIT);
  const firstTrackId = url.searchParams.get("first");
  const rawSession = url.searchParams.get("session");
  const sessionId = rawSession && /^[A-Za-z0-9-]{8,64}$/.test(rawSession) ? rawSession : null;

  let tracks;
  try {
    tracks = await fetchRadioEligibleTracks();
  } catch {
    return NextResponse.json({ error: "Couldn't load the radio catalog." }, { status: 500 });
  }

  const station = stationsFor(tracks).find((s) => s.slug === stationSlug);
  if (!station) {
    return NextResponse.json({ error: "That station isn't on the air." }, { status: 404 });
  }

  const pool = tracksForStation(tracks, station);
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const recentArtistIds = recentTrackIds
    .map((id) => byId.get(id)?.artist_id)
    .filter((id): id is string => Boolean(id));

  const requested = isUuid(firstTrackId) ? pool.find((t) => t.id === firstTrackId) : undefined;
  const picked = requested
    ? requested
    : pickNextTrack(pool.map(toRotationCandidate), recentTrackIds, recentArtistIds);
  const track = picked ? byId.get(picked.id) : null;
  if (!track) {
    return NextResponse.json({ error: "Nothing to play on this station right now." }, { status: 404 });
  }

  const audioUrl = await radioAudioUrl(track);
  if (!audioUrl) {
    return NextResponse.json({ error: "Couldn't prepare this song for playback." }, { status: 500 });
  }

  // Logging never blocks the music: a failed insert is ignored.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await createServiceRoleClient()
    .from("radio_events")
    .insert({
      track_id: track.id,
      station: station.slug,
      event: "play",
      session_id: sessionId,
      fan_id: user?.id ?? null,
    })
    .then(
      () => undefined,
      () => undefined
    );

  return NextResponse.json({
    station: { slug: station.slug, name: station.name },
    track: {
      id: track.id,
      title: track.title,
      priceCents: track.price_cents,
      coverUrl: track.cover_url,
      explicit: Boolean(track.explicit),
      aiDisclosure: track.ai_disclosure,
      isPremiere: Boolean(track.premiereEndsAt),
      artistId: track.artist_id,
      artistName: track.artists?.profiles?.display_name ?? "Unknown artist",
      audioUrl,
    },
  });
}
