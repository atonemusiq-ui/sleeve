// Plain (non-"use server") module — a "use server" file's exports must all
// be async server actions (Next.js enforces this at build time), so this
// constant and its two synchronous helpers live here instead of inside
// app/actions/tracks.ts, and both that file and app/actions/upload.ts import
// from here.
//
// Single-track pricing is a fixed $3/$4/$5 menu (see the price <select> in
// UploadForm.tsx and TrackList.tsx) rather than a free-text field. Album
// pricing is unrelated and stays a bounded range (see app/actions/albums.ts).
export const ALLOWED_TRACK_PRICE_CENTS = [300, 400, 500] as const;

export function isAllowedTrackPrice(priceCents: number): boolean {
  return (ALLOWED_TRACK_PRICE_CENTS as readonly number[]).includes(priceCents);
}

// Used by both UploadForm.tsx/publishTrack (app/actions/upload.ts) and
// TrackList.tsx/updateTrack (app/actions/tracks.ts), so the "not a valid
// price" message reads the same everywhere it can occur.
export function trackPriceError(): string {
  return `Price must be one of $${ALLOWED_TRACK_PRICE_CENTS.map((c) => (c / 100).toFixed(0)).join(", $")}.`;
}
