// Fyby Radio (Phase 10): shared, plain (non-"use server") module so the
// upload form, the dashboard track editor, the radio API routes, and the
// player can all agree on one list of moods, one way of naming stations,
// and one rotation rule.
//
// Stations are *derived*, not curated: every genre that has at least one
// radio-eligible track becomes a station automatically, same for moods, plus
// a "Fresh on Fyby" station that plays everything. That keeps a small early
// catalog from being split across empty hand-made stations, and needs no
// admin work as the catalog grows.

import { GENRES } from "@/lib/genres";

// Whole feature is hidden from fans until this is "true" in the environment
// (Vercel -> Settings -> Environment Variables). The artist-side opt-in still
// shows, so artists can opt tracks in before launch. Keep this off in
// Production until the Artist Agreement's radio license clause has been
// reviewed by a lawyer and the performance-rights licenses (ASCAP/BMI/etc.)
// are in place -- see the Phase 10 build plan's licensing section.
export function isRadioEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RADIO_ENABLED === "true";
}

// Optional mood tag on a track (the light version of Pandora's "Music
// Genome"). Validated at the app layer only, like genre, so the list can
// grow without a migration.
export const MOODS = [
  "Chill",
  "Uplifting",
  "Worship",
  "Romantic",
  "Party",
  "Workout",
  "Sunday Morning",
  "Late Night",
] as const;

export type Mood = (typeof MOODS)[number];

export function isValidMood(value: string | null | undefined): value is Mood {
  if (!value) return false;
  return (MOODS as readonly string[]).includes(value);
}

// Shown next to the opt-in checkbox. Plain-language consent, not a
// substitute for the Artist Agreement clause the lawyer still needs to draft.
export const RADIO_OPT_IN_TEXT =
  "Play this track on Fyby Radio. Fans can hear the full song for free on Fyby's radio stations, with a Buy button on screen the whole time. You can turn this off anytime from your catalog.";

// Covers are excluded: playing someone else's composition on radio needs
// songwriter licensing beyond what the artist can grant (see
// lib/coverCompliance.ts for the sale-side equivalent).
export const RADIO_EXCLUDED_GENRES = ["Covers"];

export const FRESH_STATION_SLUG = "fresh";

export type Station = {
  slug: string;
  name: string;
  kind: "fresh" | "genre" | "mood";
  // genre or mood value this station filters on (null for "fresh")
  value: string | null;
  trackCount: number;
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function genreStationSlug(genre: string) {
  return `genre-${slugify(genre)}`;
}

export function moodStationSlug(mood: string) {
  return `mood-${slugify(mood)}`;
}

// Builds the station list from the genre/mood of every radio-eligible track.
// Ordering: Fresh first, then genres in lib/genres.ts order (admin-approved
// genres after, alphabetical), then moods in MOODS order.
export function buildStations(rows: { genre: string | null; mood: string | null }[]): Station[] {
  if (rows.length === 0) return [];

  const genreCounts = new Map<string, number>();
  const moodCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.genre) genreCounts.set(row.genre, (genreCounts.get(row.genre) ?? 0) + 1);
    if (row.mood && isValidMood(row.mood)) moodCounts.set(row.mood, (moodCounts.get(row.mood) ?? 0) + 1);
  }

  const fixedOrder = GENRES as readonly string[];
  const genres = Array.from(genreCounts.keys()).sort((a, b) => {
    const ia = fixedOrder.indexOf(a);
    const ib = fixedOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const stations: Station[] = [
    { slug: FRESH_STATION_SLUG, name: "Fresh on Fyby", kind: "fresh", value: null, trackCount: rows.length },
  ];
  for (const genre of genres) {
    stations.push({
      slug: genreStationSlug(genre),
      name: genre,
      kind: "genre",
      value: genre,
      trackCount: genreCounts.get(genre)!,
    });
  }
  for (const mood of MOODS) {
    const count = moodCounts.get(mood);
    if (count) {
      stations.push({ slug: moodStationSlug(mood), name: mood, kind: "mood", value: mood, trackCount: count });
    }
  }
  return stations;
}

// ---------------------------------------------------------------------------
// Rotation rules
// ---------------------------------------------------------------------------

// New uploads get extra airplay for their first two weeks.
export const NEW_RELEASE_BOOST_DAYS = 14;
export const NEW_RELEASE_WEIGHT = 3;
// Every artist is featured free for their first month on Fyby: their songs
// come up twice as often. After that they stay in normal rotation (they
// never drop off the radio for not paying).
export const NEW_ARTIST_BOOST_DAYS = 30;
export const NEW_ARTIST_WEIGHT = 2;
// A song with an active Radio Premiere (paid heavy rotation) comes up five
// times as often, on top of the boosts above.
export const PREMIERE_WEIGHT = 5;
// The same artist won't come back within this many songs, if the station
// has enough other artists to avoid it. This is what spreads airtime across
// many different artists through the hour.
export const ARTIST_SEPARATION = 5;
// How many recently played tracks the player remembers and sends back.
export const RECENT_HISTORY_LIMIT = 20;

// ---------------------------------------------------------------------------
// Radio Premieres: an artist pays to put a new song in heavy rotation and on
// the homepage's "Premiering now" row. A one-time Fyby fee, kept in Fyby's
// own Stripe balance like the Verified Human+AI review (no artist transfer).
// ---------------------------------------------------------------------------
//
// Launch pricing, set low on purpose: early on the radio's audience is small,
// so a premiere has to be an easy impulse buy. For comparison, pitching one
// curator on SubmitHub/Groover costs about $1-2 with no guaranteed play, and
// managed playlist campaigns start around $49-80. Planned prices once
// listener numbers are proven: $9.99 / $19.99 / $29.99. Change them here;
// nothing else hard-codes a price.
export const PREMIERE_TIERS = {
  week: { label: "7 days", days: 7, priceCents: 499 },
  two_weeks: { label: "14 days", days: 14, priceCents: 999 },
  month: { label: "30 days", days: 30, priceCents: 1499 },
} as const;

export type PremiereTier = keyof typeof PREMIERE_TIERS;

export function isPremiereTier(value: unknown): value is PremiereTier {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PREMIERE_TIERS, value);
}

// Pro-plan perk: six free 7-day premieres a year, one every 60 days. Longer
// tiers, and any extra premieres, are paid like everyone else's.
export const PRO_FREE_PREMIERE_TIER: PremiereTier = "week";
export const PRO_FREE_PREMIERE_EVERY_DAYS = 60;

export type RotationCandidate = {
  id: string;
  artistId: string;
  createdAt: string;
  artistCreatedAt?: string | null;
  isPremiere?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function rotationWeight(c: RotationCandidate, now: Date = new Date()): number {
  let weight = 1;
  if (new Date(c.createdAt).getTime() >= now.getTime() - NEW_RELEASE_BOOST_DAYS * DAY_MS) weight *= NEW_RELEASE_WEIGHT;
  if (c.artistCreatedAt && new Date(c.artistCreatedAt).getTime() >= now.getTime() - NEW_ARTIST_BOOST_DAYS * DAY_MS) {
    weight *= NEW_ARTIST_WEIGHT;
  }
  if (c.isPremiere) weight *= PREMIERE_WEIGHT;
  return weight;
}

// Picks the next track. `recentTrackIds` and `recentArtistIds` are most
// recent first. Rules, relaxed in order only if nothing is left to play:
//   1. never repeat a recently played track
//   2. never repeat an artist from the last ARTIST_SEPARATION songs
// Among what's left, each track's chance is its rotationWeight(): boosted
// for new releases, artists in their first month, and paid premieres.
export function pickNextTrack(
  candidates: RotationCandidate[],
  recentTrackIds: string[],
  recentArtistIds: string[],
  now: Date = new Date(),
  random: () => number = Math.random
): RotationCandidate | null {
  if (candidates.length === 0) return null;

  const recentTracks = new Set(recentTrackIds);
  const blockedArtists = new Set(recentArtistIds.slice(0, ARTIST_SEPARATION));

  const tiers = [
    candidates.filter((c) => !recentTracks.has(c.id) && !blockedArtists.has(c.artistId)),
    candidates.filter((c) => !recentTracks.has(c.id)),
    // Last resort for a tiny station: anything except the song that just played.
    candidates.filter((c) => c.id !== recentTrackIds[0]),
    candidates,
  ];
  const pool = tiers.find((tier) => tier.length > 0)!;

  const weights = pool.map((c) => rotationWeight(c, now));
  const total = weights.reduce((sum, w) => sum + w, 0);

  let roll = random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
