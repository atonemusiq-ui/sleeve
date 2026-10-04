import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidGenre } from "@/lib/genres";
import { isConnectRole, connectRoleLabel } from "@/lib/connectRoles";
import { INTEREST_TAGS } from "@/lib/interests";

// Phase 11, the Fyby Engine: advertising.
//
// Brands buy sponsored cards aimed at interest groups. Fyby picks which card
// each viewer sees on Fyby's own pages, from Fyby's own data, so nothing
// personal ever goes to the advertiser: they get totals (views, clicks,
// estimated reach) and nothing else.
//
// The rules:
//  - Targeting by a member's interests needs an adult who said so: birth year
//    on /interests showing 18+, and personalization left on. Everyone else
//    (logged out, under 18, unknown age, opted out) only sees ads that are
//    untargeted, or that match the page itself (an artist page's genre).
//  - Sensitive traits are never targetable: the only targets are genres,
//    music-life tags (lib/interests.ts) and Connect roles.
//  - An audience under 100 people is never shown as a number.
//  - 30% of what an ad view costs goes to the artist whose page it ran on.

export const AD_CPM_CENTS = 1000; // $10 per 1,000 views
export const AD_MIN_BUDGET_CENTS = 10000; // $100
export const AD_MAX_BUDGET_CENTS = 1000000; // $10,000 per campaign
export const ARTIST_AD_SHARE_BPS = 3000; // 30%
export const MIN_AUDIENCE = 100;

export const AD_PLACEMENTS = ["discover", "connect", "merch", "artist"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export function isAdPlacement(value: unknown): value is AdPlacement {
  return typeof value === "string" && (AD_PLACEMENTS as readonly string[]).includes(value);
}

export type AdTargets = { genres: string[]; tags: string[]; roles: string[] };

const TAG_KEYS = new Set(INTEREST_TAGS.map((t) => t.key));
const TAG_LABEL = new Map(INTEREST_TAGS.map((t) => [t.key, t.label]));

export function cleanTargets(input: { genres: unknown[]; tags: unknown[]; roles: unknown[] }): AdTargets {
  const uniq = (xs: string[]) => Array.from(new Set(xs));
  return {
    genres: uniq(input.genres.filter((g): g is string => typeof g === "string" && isValidGenre(g))).slice(0, 10),
    tags: uniq(input.tags.filter((t): t is string => typeof t === "string" && TAG_KEYS.has(t))).slice(0, 13),
    roles: uniq(input.roles.filter(isConnectRole)).slice(0, 25),
  };
}

export function isUntargeted(t: AdTargets): boolean {
  return t.genres.length === 0 && t.tags.length === 0 && t.roles.length === 0;
}

export function describeTargets(t: AdTargets): string {
  if (isUntargeted(t)) return "Everyone on Fyby";
  const parts = [
    ...t.genres.map((g) => `${g} fans`),
    ...t.tags.map((k) => TAG_LABEL.get(k) ?? k),
    ...t.roles.map((r) => connectRoleLabel(r)),
  ];
  return parts.join(", ");
}

export function maxImpressionsFor(budgetCents: number, cpmCents = AD_CPM_CENTS): number {
  return Math.floor((budgetCents * 1000) / cpmCents);
}

// What 30% of a number of ad views is worth to the artist, in cents.
export function artistShareCents(impressions: number, cpmCents = AD_CPM_CENTS): number {
  return Math.floor((impressions * cpmCents * ARTIST_AD_SHARE_BPS) / (1000 * 10000));
}

function adultFromBirthYear(birthYear: number | null | undefined): boolean {
  if (!birthYear) return false;
  return new Date().getFullYear() - birthYear >= 18;
}

type Viewer = { canTarget: boolean; genres: Set<string>; tags: Set<string>; roles: Set<string> };

async function loadViewer(userId: string | null): Promise<Viewer> {
  const empty: Viewer = { canTarget: false, genres: new Set(), tags: new Set(), roles: new Set() };
  if (!userId) return empty;

  const admin = createServiceRoleClient();
  const [{ data: interests }, { data: connect }, { data: purchases }] = await Promise.all([
    admin.from("user_interests").select("genres, tags, personalized, birth_year").eq("user_id", userId).maybeSingle(),
    admin.from("connect_profiles").select("roles").eq("user_id", userId).maybeSingle(),
    admin.from("purchases").select("tracks ( genre )").eq("fan_id", userId).eq("status", "complete").limit(200),
  ]);

  const canTarget = interests?.personalized !== false && adultFromBirthYear(interests?.birth_year);
  if (!canTarget) return empty;

  const genres = new Set<string>(interests?.genres ?? []);
  for (const p of purchases ?? []) {
    const t: any = Array.isArray((p as any).tracks) ? (p as any).tracks[0] : (p as any).tracks;
    if (t?.genre) genres.add(t.genre);
  }
  return {
    canTarget,
    genres,
    tags: new Set<string>(interests?.tags ?? []),
    roles: new Set<string>(connect?.roles ?? []),
  };
}

export type ServedAd = {
  id: string;
  brand_name: string;
  headline: string;
  body: string | null;
  image_url: string | null;
  reason: string;
};

// Picks one active sponsored card for this viewer and page, or null.
// pageGenres: the page's own subject (an artist page's genres), used for
// non-personal, contextual matching that's fine for every viewer.
export async function pickAd(opts: { userId: string | null; pageGenres?: string[] }): Promise<ServedAd | null> {
  const admin = createServiceRoleClient();
  const { data: campaigns } = await admin
    .from("ad_campaigns")
    .select("id, brand_name, headline, body, image_url, target_genres, target_tags, target_roles, impressions, max_impressions")
    .eq("status", "active")
    .limit(100);

  const live = (campaigns ?? []).filter((c: any) => c.impressions < c.max_impressions);
  if (live.length === 0) return null;

  const viewer = await loadViewer(opts.userId);
  const pageGenres = new Set(opts.pageGenres ?? []);

  const scored: { ad: ServedAd; score: number }[] = [];
  for (const c of live as any[]) {
    const t: AdTargets = { genres: c.target_genres ?? [], tags: c.target_tags ?? [], roles: c.target_roles ?? [] };
    let score = 0;
    let reason = "";

    if (isUntargeted(t)) {
      score = 1;
      reason = "Shown to everyone on Fyby";
    } else {
      const pageMatch = t.genres.find((g) => pageGenres.has(g));
      if (pageMatch) {
        score = 3;
        reason = `Matches this page: ${pageMatch}`;
      }
      if (viewer.canTarget) {
        const g = t.genres.find((x) => viewer.genres.has(x));
        const tag = t.tags.find((x) => viewer.tags.has(x));
        const role = t.roles.find((x) => viewer.roles.has(x));
        const hits = [g, tag, role].filter(Boolean).length;
        if (hits > 0) {
          score = Math.max(score, 3 + hits);
          reason = role
            ? `You listed yourself as: ${connectRoleLabel(role)}`
            : tag
            ? `You told Fyby: ${TAG_LABEL.get(tag) ?? tag}`
            : `You like ${g}`;
        }
      }
    }
    if (score > 0) {
      scored.push({
        ad: { id: c.id, brand_name: c.brand_name, headline: c.headline, body: c.body, image_url: c.image_url, reason },
        score,
      });
    }
  }
  if (scored.length === 0) return null;

  // Favor the best matches, but rotate among them so one brand doesn't take
  // every view.
  const best = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score >= best - 1);
  return top[Math.floor(Math.random() * top.length)].ad;
}

export async function recordAdEvent(campaignId: string, kind: "impression" | "click", placement: AdPlacement, artistId: string | null) {
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("record_ad_event", {
    p_campaign: campaignId,
    p_kind: kind,
    p_placement: placement,
    p_artist: artistId,
  });
  if (error) console.error("Failed to record ad event:", error.message);
}

// Estimated number of members a campaign can reach with personal targeting
// (adults who left personalization on and match a target), plus pages that
// match by genre. Returns null below MIN_AUDIENCE so small groups are never
// revealed.
export async function estimateReach(t: AdTargets): Promise<number | null> {
  const admin = createServiceRoleClient();
  const adultCutoff = new Date().getFullYear() - 18;

  if (isUntargeted(t)) {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    return (count ?? 0) >= MIN_AUDIENCE ? count ?? 0 : null;
  }

  const { data: eligible } = await admin
    .from("user_interests")
    .select("user_id, genres, tags")
    .eq("personalized", true)
    .lte("birth_year", adultCutoff)
    .limit(10000);
  const ids = new Set<string>();
  const roleUsers = new Set<string>();
  if (t.roles.length > 0) {
    const { data: cp } = await admin.from("connect_profiles").select("user_id").overlaps("roles", t.roles).limit(10000);
    for (const r of cp ?? []) roleUsers.add(r.user_id);
  }
  for (const u of eligible ?? []) {
    const g = (u.genres ?? []).some((x: string) => t.genres.includes(x));
    const tg = (u.tags ?? []).some((x: string) => t.tags.includes(x));
    if (g || tg || roleUsers.has(u.user_id)) ids.add(u.user_id);
  }
  return ids.size >= MIN_AUDIENCE ? ids.size : null;
}

export function safeClickUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
