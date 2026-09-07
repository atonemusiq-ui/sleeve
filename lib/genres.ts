// Plain (non-"use server") module, same reason as lib/trackPricing.ts: a
// "use server" file's exports must all be async server actions, so this
// list and its validator live here where app/actions/upload.ts,
// app/actions/tracks.ts, UploadForm.tsx, TrackList.tsx, and the storefront
// can all share one source of truth.
//
// Genre is optional on a track — an artist can leave it unset — and is
// validated against this fixed list server-side so the storefront's genre
// filter always has a known, finite set of values to build pills from. This
// base list is intentionally frozen (an admin-approved suggestion is layered
// on top instead, see approved_genres below) so existing tracks' genre
// values never stop matching a row.
export const GENRES = [
  "Gospel/Christian",
  "R&B/Soul",
  "Hip-Hop/Rap",
  "Pop",
  "Jazz",
  "Rock",
  "Country",
  "Electronic/Dance",
  "House",
  "Latin",
  "Afrobeat",
  "Afrobeat Instrumentals",
  "Classical",
  "Covers",
  "Other",
] as const;

export type Genre = (typeof GENRES)[number];

export function isValidGenre(value: string | null | undefined): value is Genre {
  if (!value) return false;
  return (GENRES as readonly string[]).includes(value);
}

// A cover is, by definition, someone else's composition — the platform
// requires crediting and paying the original songwriter(s)/producer(s) for
// any track tagged with this genre. See lib/coverCompliance.ts for the
// enforcement (blocks a sale until that credit exists as a contributor).
export const COVERS_GENRE: Genre = "Covers";

// The free-text tag is a single short label per track (an artist's own
// word for their sound that isn't on the fixed genre list) — capped well
// short of anything that'd break a storefront pill's layout.
export const MAX_CUSTOM_TAG_LENGTH = 30;

// Subgenre depth under a few top-level genres — optional, only offered on
// the upload form when the chosen genre has an entry here, and validated
// the same way as `genre` itself (app-layer only, see app/actions/upload.ts
// and app/actions/tracks.ts) so this can grow without a migration either.
export const SUBGENRES: Partial<Record<Genre, readonly string[]>> = {
  "Hip-Hop/Rap": ["Gospel Rap", "West Coast", "New York", "Positive/Conscious"],
  "R&B/Soul": ["R&B 80s", "R&B 90s", "R&B 2000s"],
  Rock: ["Classic Rock", "Alternative/Indie", "Hard Rock/Metal"],
  Country: ["Love Songs"],
};

export function subgenresFor(genre: string | null | undefined): readonly string[] {
  if (!genre || !isValidGenre(genre)) return [];
  return SUBGENRES[genre] ?? [];
}

export function isValidSubgenre(genre: string | null | undefined, subgenre: string | null | undefined): boolean {
  if (!subgenre) return true; // subgenre is always optional
  return subgenresFor(genre).includes(subgenre);
}

// A suggested genre name goes through /admin/genres review before it's
// selectable — see genre_suggestions/approved_genres in supabase/schema.sql.
export const MAX_GENRE_SUGGESTION_LENGTH = 40;
