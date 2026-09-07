// The bio music video is a paid add-on (see app/actions/video.ts for the
// Stripe checkout that unlocks it) rather than something every artist gets
// for free — video is expensive to store/serve compared to a photo, and a
// pasted link costs Fyby nothing at all, hence the three tiers below rather
// than one flat price. `priceCents` here is the only source of truth for
// what Stripe actually charges (see startVideoUnlockCheckout) — never
// trust a client-supplied price for this.
export const VIDEO_TIER_OPTIONS = [
  {
    value: "link",
    label: "Link a video",
    description: "Paste a YouTube or Vimeo link — embedded on your artist page.",
    priceCents: 999,
  },
  {
    value: "upload",
    label: "Upload a video",
    description: "Upload your own video file directly.",
    priceCents: 1999,
  },
  {
    value: "both",
    label: "Both",
    description: "Link a video or upload one, whichever you prefer.",
    priceCents: 2999,
  },
] as const;

export type VideoTier = (typeof VIDEO_TIER_OPTIONS)[number]["value"];

export function isVideoTier(value: unknown): value is VideoTier {
  return VIDEO_TIER_OPTIONS.some((o) => o.value === value);
}

export function videoTierOption(tier: VideoTier) {
  return VIDEO_TIER_OPTIONS.find((o) => o.value === tier)!;
}

// Whether a given entry method (an artist actually adding a link vs.
// uploading a file) is covered by the tier they've paid for.
export function tierAllows(tier: VideoTier | null, method: "link" | "upload"): boolean {
  if (!tier) return false;
  return tier === "both" || tier === method;
}
