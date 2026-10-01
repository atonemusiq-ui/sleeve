import type { Plan } from "@/lib/plans";

// Fyby's cut on merch, decided in the Merch Booth plan:
//   Pro plan:            no fee; the Merch Booth is part of the subscription.
//   Free and Artist:     25% of the artist's PROFIT (sale price minus what
//                        Printful charges to make it) plus $0.20 per order.
//
// Taken from profit, not the sticker price, because on print-on-demand the
// product cost is often half the price: 25% of a $30 shirt would leave the
// artist less than Fyby. Shipping is charged to the fan and passed straight
// through to Printful, so it isn't part of either side's share.
//
// Like track sales (lib/checkoutSession.ts), Stripe's card fee comes out of
// Fyby's side, not the artist's, so the payout below is exactly what lands
// in the artist's account.
export const MERCH_FEE_BPS = 2500;
export const MERCH_ORDER_FEE_CENTS = 20;

// What Fyby charges the fan for shipping, in cents. Printful's real cost
// varies by product and destination; this flat rate is the fan-facing
// price. Set MERCH_SHIPPING_CENTS in Vercel to change it without a deploy.
export function merchShippingCents(): number {
  const raw = Number(process.env.MERCH_SHIPPING_CENTS);
  return Number.isInteger(raw) && raw >= 0 ? raw : 599;
}

export type MerchSplit = {
  amountCents: number; // what the fan pays for the items, before shipping and tax
  costCents: number; // what Printful charges to make them
  profitCents: number;
  platformFeeCents: number;
  artistPayoutCents: number;
};

export function merchSplit(unitPriceCents: number, unitCostCents: number, quantity: number, plan: Plan): MerchSplit {
  const amountCents = unitPriceCents * quantity;
  const costCents = unitCostCents * quantity;
  const profitCents = Math.max(0, amountCents - costCents);

  let platformFeeCents = 0;
  if (plan !== "pro") {
    platformFeeCents = Math.round((profitCents * MERCH_FEE_BPS) / 10000) + MERCH_ORDER_FEE_CENTS;
  }
  // The fee can never take more than the profit itself.
  platformFeeCents = Math.min(platformFeeCents, profitCents);

  return {
    amountCents,
    costCents,
    profitCents,
    platformFeeCents,
    artistPayoutCents: profitCents - platformFeeCents,
  };
}

// The lowest base price an artist may set: Printful's cost plus at least $5
// of profit, so no listing can lose money once card fees are paid.
export const MIN_PROFIT_CENTS = 500;

export function minimumPriceCents(baseCostCents: number): number {
  return baseCostCents + MIN_PROFIT_CENTS;
}

// Merch can take real money only when orders can actually be printed:
// either a Printful key is set, or Stripe is in test mode (where orders are
// recorded as "test_mode" and nothing is printed). Stops a live launch from
// charging fans for shirts nobody will make.
export function merchCheckoutEnabled(): boolean {
  if (process.env.PRINTFUL_API_KEY) return true;
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
