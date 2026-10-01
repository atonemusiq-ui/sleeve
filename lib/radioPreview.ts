// The sample song shown in the Fyby Radio "Coming soon" player preview:
// A-Tone's "Heat Check". Uses the real track (artwork and price) once it's
// uploaded; until then, the title as display text on the default cover.
// Shared by the homepage (app/page.tsx) and /radio.

import { DEFAULT_TRACK_COVER_URL } from "@/lib/defaultCover";
import type { RadioPreviewTrack } from "@/app/RadioHero";

export function radioPreviewTrack(
  tracks: { title?: string | null; cover_url?: string | null; price_cents?: number; artists?: any }[]
): RadioPreviewTrack {
  const heatCheck = tracks.find((t) => /heat\s*check/i.test(t.title ?? ""));
  if (heatCheck) {
    return {
      title: heatCheck.title ?? "Heat Check",
      coverUrl: heatCheck.cover_url ?? DEFAULT_TRACK_COVER_URL,
      artistName: heatCheck.artists?.profiles?.display_name ?? "A-Tone",
      priceCents: heatCheck.price_cents ?? 500,
    };
  }
  return { title: "Heat Check", coverUrl: DEFAULT_TRACK_COVER_URL, artistName: "A-Tone", priceCents: 500 };
}
