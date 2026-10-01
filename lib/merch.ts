import type { Plan } from "@/lib/plans";
import { shippingCents, type MerchProductKey } from "@/lib/merchCatalog";

// Who pays what on a merch order.
//
// Fyby's cut, decided in the Merch Booth plan:
//   Pro plan:         no fee; the Merch Booth is part of the subscription.
//   Free and Artist:  25% of the artist's PROFIT (their price minus what
//                     Printful charges to make it) plus $0.20 per order.
//
// Shipping: the fan pays Printful's real US rate for the product
// (lib/merchCatalog.ts), added at checkout. Fyby doesn't cover any of it.
//
// Card fee (Stripe, 2.9% + 30¢ of the whole charge): split between fan and
// artist. The fan's half is built into the price they see, not added as a
// separate "card fee" line, because California bans card surcharges, no
// state allows them on debit cards, and California's honest-pricing law
// requires any mandatory fee to be inside the advertised price (shipping and
// tax are the only things allowed on top). The artist's half comes out of
// their payout. Fyby covers neither.
export const MERCH_FEE_BPS = 2500;
export const MERCH_ORDER_FEE_CENTS = 20;

// Stripe's standard US card rate. International cards cost Stripe 1.5% more;
// that difference isn't passed on.
const CARD_FEE_BPS = 290;
const CARD_FEE_FIXED_CENTS = 30;

export function cardFeeCents(chargeCents: number): number {
  return Math.round((chargeCents * CARD_FEE_BPS) / 10000) + CARD_FEE_FIXED_CENTS;
}

// The fan's half of the card fee on one unit, built into the unit price.
// Solves  share = cardFee(price + share + shipping) / 2  for a single-item
// order, rounded up to the cent.
export function buyerCardShareCents(artistUnitPriceCents: number, key: MerchProductKey): number {
  const base = artistUnitPriceCents + shippingCents(key, 1);
  const rate = CARD_FEE_BPS / 10000;
  return Math.ceil((base * rate + CARD_FEE_FIXED_CENTS) / (2 - rate));
}

// What the fan sees and pays per unit (before shipping and tax).
export function fanUnitPriceCents(artistUnitPriceCents: number, key: MerchProductKey): number {
  return artistUnitPriceCents + buyerCardShareCents(artistUnitPriceCents, key);
}

export type MerchSplit = {
  fanUnitPriceCents: number;
  itemsCents: number; // what the fan pays for the items, before shipping and tax
  shippingCents: number;
  totalCents: number; // the whole card charge (no tax while Stripe Tax is off)
  cardFeeCents: number;
  buyerCardShareCents: number;
  artistCardShareCents: number;
  profitCents: number; // artist's price minus printing, before fees
  platformFeeCents: number;
  artistPayoutCents: number;
};

// artistUnitPriceCents: the artist's price for this size (base price plus
// Printful's own size upcharge), before the fan's card-fee share.
export function merchSplit(
  artistUnitPriceCents: number,
  unitCostCents: number,
  quantity: number,
  plan: Plan,
  key: MerchProductKey
): MerchSplit {
  const buyerShareUnit = buyerCardShareCents(artistUnitPriceCents, key);
  const fanUnit = artistUnitPriceCents + buyerShareUnit;
  const itemsCents = fanUnit * quantity;
  const ship = shippingCents(key, quantity);
  const totalCents = itemsCents + ship;
  const cardFee = cardFeeCents(totalCents);
  const buyerCardShare = buyerShareUnit * quantity;
  const artistCardShare = Math.max(0, cardFee - buyerCardShare);

  const profitCents = Math.max(0, (artistUnitPriceCents - unitCostCents) * quantity);

  let platformFeeCents = 0;
  if (plan !== "pro") {
    platformFeeCents = Math.round((profitCents * MERCH_FEE_BPS) / 10000) + MERCH_ORDER_FEE_CENTS;
  }
  // Fees can never take more than the profit itself.
  platformFeeCents = Math.min(platformFeeCents, profitCents);
  const artistPayoutCents = Math.max(0, profitCents - platformFeeCents - artistCardShare);

  return {
    fanUnitPriceCents: fanUnit,
    itemsCents,
    shippingCents: ship,
    totalCents,
    cardFeeCents: cardFee,
    buyerCardShareCents: buyerCardShare,
    artistCardShareCents: artistCardShare,
    profitCents,
    platformFeeCents,
    artistPayoutCents,
  };
}

// The lowest base price an artist may set: Printful's cost plus at least $5
// of profit.
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
