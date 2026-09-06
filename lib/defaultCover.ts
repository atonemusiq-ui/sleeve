// Shown as a track's artwork until (or unless) the artist uploads their own
// — every track gets a real cover_url now instead of sometimes having none
// (see app/actions/upload.ts for the server-side default, and
// UploadForm.tsx for the client-side preview of that same default before
// publishing). A plain static asset under /public rather than anything in
// Supabase Storage, since it's identical for every artist and never changes
// per-track.
export const DEFAULT_TRACK_COVER_URL = "/fyby-default-cover.svg";
