// Fyby TV (Phase 10): the homepage video player. Plain (non-"use server")
// module shared by the homepage, the admin page, the artist premiere form,
// and the Stripe webhook.
//
// Three channels:
//   - whats_new: Fyby's own announcements and upcoming features
//   - how_to:    tutorials on using Fyby and marketing your music on it
//   - premiere:  paid artist music-video premieres (Pro plan only)
//
// Every video is a YouTube or Vimeo link (lib/videoEmbed.ts), so hosting
// and streaming cost Fyby nothing.

import { PREMIERE_TIERS } from "@/lib/radio";

export const TV_CATEGORIES = {
  premiere: { label: "Premieres", blurb: "New music videos from Fyby artists." },
  whats_new: { label: "What's New", blurb: "New and upcoming features on Fyby." },
  how_to: { label: "How-To", blurb: "Get the most out of Fyby and market your music." },
} as const;

export type TvCategory = keyof typeof TV_CATEGORIES;

export function isTvCategory(value: unknown): value is TvCategory {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TV_CATEGORIES, value);
}

// Categories Fyby posts itself from /admin/fyby-tv. Premieres only come
// from artists paying for one.
export const ADMIN_TV_CATEGORIES: TvCategory[] = ["whats_new", "how_to"];

// Video Premieres use the same launch prices and lengths as Radio Premieres
// so artists only have one price list to learn. Pro plan only.
export const VIDEO_PREMIERE_TIERS = PREMIERE_TIERS;

// How far ahead an artist can schedule a premiere's start (for a countdown).
export const MAX_PREMIERE_LEAD_DAYS = 30;

export const MAX_TV_TITLE_LENGTH = 80;
export const MAX_TV_DESCRIPTION_LENGTH = 280;

export type TvVideo = {
  id: string;
  category: TvCategory;
  title: string;
  description: string | null;
  videoUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  trackId: string | null;
  trackPriceCents: number | null;
  artistId: string | null;
  artistName: string | null;
};
