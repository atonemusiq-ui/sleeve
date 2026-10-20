// An artist taking down one of their own songs (app/actions/tracks.ts
// removeTrack). A song with sales can't be deleted -- buyers keep it -- so it
// is frozen like an admin takedown, with this marker as the reason. That's
// how the catalog tells "you removed this, restore it any time" apart from
// an admin freeze, which only an admin can lift.
export const REMOVED_BY_ARTIST = "__removed_by_artist__";

export function isRemovedByArtist(track: { frozen?: boolean | null; frozen_reason?: string | null }): boolean {
  return Boolean(track.frozen) && track.frozen_reason === REMOVED_BY_ARTIST;
}
