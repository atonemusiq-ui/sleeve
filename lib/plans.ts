// The artist subscription plans, and the single source of truth for what cut
// Fyby takes from a sale.
//
// Before this file the 20% was written out five separate times — in
// app/actions/checkout.ts, lib/checkoutSession.ts, both branches of
// app/api/webhooks/stripe/route.ts (gifts and album splits) and the Super Fan
// payout in app/api/webhooks/stripe-subscriptions/route.ts. Changing the rate
// meant finding all five and getting the rounding identical in each.
//
// The model: a plan does not add features on top of the cut, it BUYS THE CUT
// DOWN. An artist on Free pays 15% and nothing monthly; Artist and Pro trade a
// monthly fee for a smaller share of every sale, so each upgrade pays for
// itself at a sales figure the artist can check against their own numbers
// (breakEvenCentsPerMonth below). Everything an artist can do today stays on
// Free — no existing artist loses anything when plans ship.
export type Plan = "free" | "artist" | "pro";

// rateBps is the cut in BASIS POINTS (hundredths of a percent), not a float:
// 1500 = 15%. Money must never be computed from a float percentage that can
// drift — the arithmetic below is integer multiply then one divide.
export const PLANS = {
  free: {
    label: "Free",
    priceCents: 0,
        rateBps: 1500,
  },
  artist: {
    label: "Artist",
    priceCents: 1000,
    rateBps: 1000,
  },
  pro: {
    label: "Pro",
    priceCents: 2500,
    rateBps: 500,
  },
} as const satisfies Record<Plan, { label: string; priceCents: number; rateBps: number }>;

export const DEFAULT_PLAN: Plan = "free";

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PLANS, value);
}

// Normalizes whatever came back from the database. A null (a row written
// before the column existed), an unknown string (a plan removed in a later
// release), or a missing join all fall back to Free — the safe direction,
// since Free is the highest cut and the fewest entitlements.
export function planOf(value: unknown): Plan {
  return isPlan(value) ? value : DEFAULT_PLAN;
}

// Fyby's cut of one sale, in cents. Integer multiply before the divide, so
// there is no floating-point rate to drift. At 2000 bps this returns the same
// cent as the `Math.round(amountCents * 0.2)` it replaced, for every integer
// amount from $0 to $50,000 — checked exhaustively before the swap, so moving
// onto this function changed no existing payout.
export function commissionCents(
  amountCents: number,
  plan: Plan,
  opts?: { fybyDay?: boolean }
): number {
  // Fyby Day (see isFybyDay below): Fyby waives its cut entirely, so the
  // artist's payout is the whole sale. Opt-in per call site rather than read
  // from the clock in here, so the webhook can honour the day the fan
  // actually checked out on even when the event arrives after midnight.
  if (opts?.fybyDay) return 0;
  return Math.round((amountCents * PLANS[plan].rateBps) / 10000);
}

// What the artist is owed from one sale. Always the remainder of the amount
// rather than its own rounded percentage, so the two halves can never fail to
// sum back to exactly what the fan paid.
export function payoutCents(
  amountCents: number,
  plan: Plan,
  opts?: { fybyDay?: boolean }
): number {
  return amountCents - commissionCents(amountCents, plan, opts);
}

// Monthly sales at which a plan starts paying for itself against Free, in
// cents — the number that makes an upgrade checkable rather than a leap of
// faith ("Artist pays for itself at $100/month in sales"). Returns null for a
// plan that costs nothing, or one whose cut isn't actually lower than Free's.
export function breakEvenCentsPerMonth(plan: Plan): number | null {
  const { priceCents, rateBps } = PLANS[plan];
  const saved = PLANS[DEFAULT_PLAN].rateBps - rateBps;

  if (priceCents <= 0 || saved <= 0) return null;

  return Math.ceil((priceCents * 10000) / saved);
}

// ---------------------------------------------------------------------------
// Fyby Day: on the first Friday of every month Fyby takes 0% of one-time fan
// payments (track, album, gift and license sales). Super Fan subscriptions
// keep their normal cut -- they're recurring, so a monthly "day" doesn't map
// onto them. Fyby still pays Stripe's processing fee on those sales, so the
// day costs the platform roughly 3% of that day's sales; that's the price of
// the promotion.
//
// Judged in Pacific time (Fyby's home time zone) so "Friday" means the same
// day for every artist promoting it, wherever the server happens to run.
const FYBY_DAY_TZ = "America/Los_Angeles";

function pacificParts(at: Date): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FYBY_DAY_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

export function isFybyDay(at: Date = new Date()): boolean {
  const { day, weekday } = pacificParts(at);
  // The first Friday always falls on day 1-7 of the month.
  return weekday === 5 && day <= 7;
}

// The next Fyby Day on or after `from`, as a "YYYY-MM-DD" Pacific date --
// used for the "Next Fyby Day" banner. Walks forward a day at a time; the
// answer is never more than 35 days away.
export function nextFybyDay(from: Date = new Date()): string {
  for (let i = 0; i < 40; i++) {
    const candidate = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    if (isFybyDay(candidate)) {
      const { year, month, day } = pacificParts(candidate);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return "";
}

export function formatFybyDay(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
