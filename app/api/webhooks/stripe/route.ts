import { stripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

// Stripe needs the raw, unparsed request body to verify the webhook
// signature, so we don't let Next.js parse it as JSON first.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const trackId = session.metadata?.track_id;
    const amountCents = session.metadata?.amount_cents;
    const platformFeeCents = session.metadata?.platform_fee_cents;
    const artistPayoutCents = session.metadata?.artist_payout_cents;
    const buyerEmail = session.customer_details?.email ?? null;
    const buyerPhone = session.customer_details?.phone ?? null;
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    if (!trackId || !amountCents || !platformFeeCents || !artistPayoutCents) {
      console.error("Webhook missing expected metadata:", session.metadata);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Stripe can and does redeliver the same event more than once (retries,
    // duplicate delivery). Without a check here, a redelivery would insert a
    // second purchase row for the same payment AND run the transfer below a
    // second time — double-paying the artist out of the platform's Stripe
    // balance. Guard on the payment intent id (unique, partial index in
    // supabase/schema.sql) before doing anything else.
    if (paymentIntentId) {
      const { data: existing } = await supabase
        .from("purchases")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ received: true, note: "already processed" });
      }
    }

    const { error } = await supabase.from("purchases").insert({
      track_id: trackId,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      amount_cents: Number(amountCents),
      platform_fee_cents: Number(platformFeeCents),
      artist_payout_cents: Number(artistPayoutCents),
      stripe_payment_intent_id: paymentIntentId,
      status: "complete",
    });

    if (error) {
      // A unique-violation here (code 23505) means we lost a race against
      // another delivery of the same event between the check above and this
      // insert — that's still "already processed", not a real failure, so
      // don't 500 (which would just trigger yet another retry).
      if ((error as any).code === "23505") {
        return NextResponse.json({ received: true, note: "already processed" });
      }
      console.error("Failed to record purchase:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // The purchase is recorded, but the payment itself landed entirely in
    // this platform's own Stripe balance — nothing above has paid the
    // artist their share yet. Look up the artist's connected account for
    // this track and transfer their cut over now.
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("artists ( stripe_account_id )")
      .eq("id", trackId)
      .single();

    const artistStripeAccountId = (track as any)?.artists?.stripe_account_id;

    if (trackError || !artistStripeAccountId) {
      // Don't fail the webhook over this — the purchase is already
      // recorded, and Stripe would just retry redelivery (risking a
      // duplicate purchase row) for a problem a retry can't fix anyway.
      // Log it loudly so the payout can be investigated/sent manually.
      console.error(
        "No connected Stripe account found for this track's artist — purchase recorded but artist was not paid:",
        trackError?.message ?? `track ${trackId} has no linked stripe_account_id`
      );
    } else if (paymentIntentId) {
      try {
        // Retrieving the PaymentIntent for its `latest_charge` lets us pass
        // `source_transaction` below, which ties this transfer to the
        // specific charge that funded it (Stripe's recommended pattern for
        // "separate charges and transfers"), rather than drawing from the
        // platform's general available balance.
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const chargeId =
          typeof paymentIntent.latest_charge === "string"
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge?.id;

        await stripe.transfers.create({
          amount: Number(artistPayoutCents),
          currency: "usd",
          destination: artistStripeAccountId,
          source_transaction: chargeId,
          transfer_group: trackId,
        });
      } catch (transferError: any) {
        // Same reasoning as above: log and move on rather than 500'ing and
        // triggering a retry that would try to insert a duplicate purchase.
        console.error("Failed to transfer artist payout:", transferError.message);
      }
    }
  }

  return NextResponse.json({ received: true });
}
