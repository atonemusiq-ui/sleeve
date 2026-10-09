// Fyby's release phases: which features belong to which version of the app.
//
// The whole app is built, but Fyby launches lean (Phase 1) and switches the
// rest back on one release at a time, every 3-4 months. This file is the one
// place that says what ships when. Nothing is deleted at any phase -- a
// feature from a later phase is only hidden (its links and homepage sections
// disappear and its pages redirect home).
//
// Two ways the phase gets chosen:
//   1. LIVE: the FYBY_PHASE environment variable in Vercel. Unset = 6, the
//      full app, which is exactly how the site behaves today. On launch day
//      set FYBY_PHASE=1 and redeploy; raise it with each release.
//   2. PREVIEW (investor demo): the admin account can pick any phase from the
//      phase switcher bar. That choice lives in a cookie and only counts for
//      the admin -- everyone else always sees the live phase.
//
// Kept free of server-only imports so middleware (edge runtime) can use it.

export type Phase = 1 | 2 | 3 | 4 | 5 | 6;

export const MAX_PHASE: Phase = 6;

export const PHASES: Record<Phase, { name: string; target: string; summary: string }> = {
  1: {
    name: "Launch",
    target: "Jan 2027",
    summary: "Storefront, checkout, 80%+ payouts in days, contributor splits, plans, AI disclosure",
  },
  2: { name: "Vinyl + Trust", target: "Apr 2027", summary: "Verified badge and human verification" },
  3: { name: "Fyby Radio", target: "Jul 2027", summary: "Nonstop radio and Radio Premieres" },
  4: { name: "Fyby TV + AI Music", target: "Oct 2027", summary: "Video player, video premieres, 100% AI music section" },
  5: { name: "Merch Booth + Connect", target: "Jan 2028", summary: "Print-on-demand merch and collaborator search" },
  6: { name: "The Experience", target: "Apr 2028", summary: "Fyby AI matching and the advertiser program" },
};

// The phase each feature first appears in. Anything not listed here (the
// storefront, checkout, dashboard, payouts, contributors, plans, albums,
// gifts, Super Fan, booking, licensing...) is part of Phase 1.
export const FEATURE_PHASE = {
  verified: 2,
  radio: 3,
  tv: 4,
  aiMusic: 4,
  merch: 5,
  connect: 5,
  ads: 6,
  interests: 6,
} as const satisfies Record<string, Phase>;

export type Feature = keyof typeof FEATURE_PHASE;

// URL prefixes that belong to a later-phase feature. Admin pages are never
// gated, so content can be prepared before a feature goes public.
const ROUTE_FEATURES: [prefix: string, feature: Feature][] = [
  ["/radio", "radio"],
  ["/api/radio", "radio"],
  ["/tv", "tv"],
  ["/ai-music", "aiMusic"],
  ["/merch", "merch"],
  ["/dashboard/merch", "merch"],
  ["/connect", "connect"],
  ["/advertise", "ads"],
  ["/interests", "interests"],
];

export const PREVIEW_COOKIE = "fyby_preview_phase";
export const PHASE_HEADER = "x-fyby-phase";
export const ADMIN_HEADER = "x-fyby-admin";

// Same allowlist as app/actions/admin.ts.
export const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email));
}

export function parsePhase(value: unknown): Phase | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_PHASE ? (n as Phase) : null;
}

// The phase the public sees. Unset or invalid = the full app.
export function livePhase(): Phase {
  return parsePhase(process.env.FYBY_PHASE) ?? MAX_PHASE;
}

export function isFeatureOn(feature: Feature, phase: Phase): boolean {
  return phase >= FEATURE_PHASE[feature];
}

export function featureForPath(pathname: string): Feature | null {
  for (const [prefix, feature] of ROUTE_FEATURES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return feature;
  }
  return null;
}
