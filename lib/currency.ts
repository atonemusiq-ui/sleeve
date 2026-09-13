// Stripe's "zero-decimal" currencies express amounts in whole units already
// (e.g. a JPY amount of 500 means ¥500, not ¥5.00) — every other currency,
// including USD, is in the smallest unit (cents) the same way the rest of
// this codebase already assumes. This only matters here because Stripe
// Adaptive Pricing (a pure Dashboard toggle — Settings -> Adaptive Pricing,
// no code changes to Fyby's own USD-denominated price_data/Connect payout
// math) can present a Checkout Session's `presentment_details` in any of
// these currencies when a fan pays in their own local currency instead of
// USD. See app/success/page.tsx for the only place this is read.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

export function formatPresentmentAmount(amount: number, currency: string): string {
  const upper = currency.toUpperCase();
  const value = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? amount : amount / 100;

  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: upper }).format(value);
  } catch {
    // Intl can throw on a currency code it doesn't recognize — shouldn't
    // normally happen since Stripe only ever sends real ISO 4217 codes, but
    // this keeps the page rendering instead of erroring out over a display
    // nicety.
    return `${value.toFixed(2)} ${upper}`;
  }
}
