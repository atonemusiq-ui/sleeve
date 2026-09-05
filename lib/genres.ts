// Plain (non-"use server") module, same reason as lib/trackPricing.ts: a
// "use server" file's exports must all be async server actions, so this
// list and its validator live here where app/actions/upload.ts,
// app/actions/tracks.ts, UploadForm.tsx, TrackList.tsx, and the storefront
// can all share one source of truth.
//
// Genre is optional on a track — an artist can leave it unset — and is
// validated against this fixed list server-side so the storefront's genre
// filter always has a known, finite set of values to build pills from.
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
