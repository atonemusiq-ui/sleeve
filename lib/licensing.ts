// Beat & sync licensing: an artist can sell the RIGHT TO USE a song, not just
// a copy to listen to. Three non-exclusive tiers, each switched on by giving
// it a price (a null price = tier not offered):
//
//   beat       -- a producer's beat lease: record and release one new song
//                 over this track
//   standard   -- sync for online content: YouTube, podcasts, social, streams,
//                 student and independent films
//   commercial -- everything in standard plus ads, brand/sponsored content,
//                 TV, broadcast and theatrical film
//
// Every license is non-exclusive (the artist keeps the song and can keep
// licensing it), and the money moves exactly like a sale: the artist's plan
// sets Fyby's cut (lib/plans.ts, 0% on Fyby Day), contributors are paid their
// split of the artist's share, and the artist is paid the rest. The full
// plain-language terms a buyer agrees to live at /licenses/terms.
//
// Covers can never be licensed: the cover artist doesn't own the song, so a
// sync or beat license isn't theirs to sell.

export type LicenseTier = "beat" | "standard" | "commercial";

export const LICENSE_TIER_ORDER: LicenseTier[] = ["beat", "standard", "commercial"];

export const LICENSE_TIERS: Record<
  LicenseTier,
  {
    label: string;
    column: "license_beat_cents" | "license_standard_cents" | "license_commercial_cents";
    summary: string;
    // Bounds the artist can price within, in cents.
    minCents: number;
    maxCents: number;
    suggestedCents: number;
  }
> = {
  beat: {
    label: "Beat lease",
    column: "license_beat_cents",
    summary:
      "Record and release one new song using this track as the instrumental, on streaming services and for sale, with credit to the producer.",
    minCents: 1000,
    maxCents: 100000,
    suggestedCents: 3000,
  },
  standard: {
    label: "Standard sync license",
    column: "license_standard_cents",
    summary:
      "Use this song in online content you make: YouTube and social videos, podcasts, livestreams, student and independent films.",
    minCents: 1000,
    maxCents: 100000,
    suggestedCents: 4900,
  },
  commercial: {
    label: "Commercial sync license",
    column: "license_commercial_cents",
    summary:
      "Everything in Standard, plus advertising, brand and sponsored content, TV, broadcast and theatrical film.",
    minCents: 5000,
    maxCents: 1000000,
    suggestedCents: 29900,
  },
};

export function isLicenseTier(value: unknown): value is LicenseTier {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LICENSE_TIERS, value);
}

// Display label for a tier read back from the database (typed loosely there).
export function licenseTierLabel(value: unknown): string {
  return isLicenseTier(value) ? LICENSE_TIERS[value as LicenseTier].label : String(value ?? "License");
}

export type LicensePricing = {
  license_enabled?: boolean | null;
  license_beat_cents?: number | null;
  license_standard_cents?: number | null;
  license_commercial_cents?: number | null;
};

// The tiers a track actually offers right now, cheapest first.
export function offeredTiers(track: LicensePricing): { tier: LicenseTier; priceCents: number }[] {
  if (!track.license_enabled) return [];
  return LICENSE_TIER_ORDER.flatMap((tier) => {
    const price = track[LICENSE_TIERS[tier].column];
    return typeof price === "number" && price > 0 ? [{ tier, priceCents: price }] : [];
  });
}

// Parses a dollar amount typed by the artist into cents, checked against the
// tier's bounds. Blank = tier not offered (null, no error).
export function parseTierPrice(
  tier: LicenseTier,
  raw: string | null | undefined
): { cents: number | null; error?: string } {
  const value = (raw ?? "").trim().replace(/^\$/, "");
  if (!value) return { cents: null };
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return { cents: null, error: `${LICENSE_TIERS[tier].label}: enter a price like 49 or 49.99.` };
  }
  const cents = Math.round(parseFloat(value) * 100);
  const { minCents, maxCents, label } = LICENSE_TIERS[tier];
  if (cents < minCents || cents > maxCents) {
    return {
      cents: null,
      error: `${label} must be between $${(minCents / 100).toFixed(0)} and $${(maxCents / 100).toLocaleString()}.`,
    };
  }
  return { cents };
}

export const MAX_LICENSEE_NAME_LENGTH = 120;
export const MAX_PROJECT_LENGTH = 300;

// Short human-readable license number shown on the certificate, derived from
// the row id so it never needs its own column.
export function licenseNumber(id: string): string {
  return `FYBY-L-${id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}
