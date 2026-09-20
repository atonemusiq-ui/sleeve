import { stripe } from "@/lib/stripe/server";

// Sends an artist their cut of a payment that landed in the platform's own
// Stripe balance, using Stripe's "separate charges and transfers" pattern:
// `source_transaction` ties the transfer to the original charge, so the money
// moves out of that specific payment rather than the platform's general
// balance (which may not have settled funds yet).
//
// Shared by both webhook destinations — one-time purchases and gifts in
// app/api/webhooks/stripe/route.ts, Super Fan subscription invoices in
// app/api/webhooks/stripe-subscriptions/route.ts — so the payout mechanics
// only exist in one place.
export async function transferArtistPayout(
  paymentIntentId: string,
  amountCents: number,
  stripeAccountId: string,
  transferGroup: string
) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id;

  return stripe.transfers.create({
    amount: amountCents,
    currency: "usd",
    destination: stripeAccountId,
    source_transaction: chargeId,
    transfer_group: transferGroup,
  });
}
