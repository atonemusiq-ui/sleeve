// The picture for an artist's round avatar (the Artists on Fyby directory and
// the top of their artist page). Uses the best photo the artist has given us:
// their profile (bio) photo, else the first gallery photo, else the cover art
// of their newest song. null = nothing usable yet, so the ♪ placeholder shows.
// Fyby's generic default cover is skipped; it isn't a picture of the artist.
const DEFAULT_COVER = "/fyby-default-cover.svg";

export function artistCirclePhoto(artist: {
  bio_photo_url?: string | null;
  gallery_urls?: (string | null)[] | null;
  tracks?: { cover_url?: string | null; created_at?: string | null; frozen?: boolean | null }[] | null;
}): string | null {
  if (artist.bio_photo_url) return artist.bio_photo_url;
  const gallery = (artist.gallery_urls ?? []).find(Boolean);
  if (gallery) return gallery;
  const cover = [...(artist.tracks ?? [])]
    .filter((t) => !t.frozen && t.cover_url && !t.cover_url.endsWith(DEFAULT_COVER))
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]?.cover_url;
  return cover ?? null;
}
