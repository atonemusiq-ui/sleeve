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
    const fanId = session.metadata?.fan_id ?? null;
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

    const { data: insertedPurchase, error } = await supabase
      .from("purchases")
      .insert({
        track_id: trackId,
        // Checkout requires login now (see app/actions/checkout.ts), so this
        // should always be present — but stay tolerant of null in case an
        // older/anonymous session's checkout completes after this deploy.
        fan_id: fanId,
        buyer_email: buyerEmail,
        buyer_phone: buyerPhone,
        amount_cents: Number(amountCents),
        platform_fee_cents: Number(platformFeeCents),
        artist_payout_cents: Number(artistPayoutCents),
        stripe_payment_intent_id: paymentIntentId,
        status: "complete",
      })
      .select("id")
      .single();

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

    // Contributor royalty split: anyone with a percentage on this track gets
    // a `contributor_payouts` row for their proportional cut of the
    // artist's payout, tracked separately as "owed" until the artist marks
    // it paid (app/actions/contributors.ts). This is bookkeeping only — it
    // doesn't move any money on its own; the full artist_payout_cents still
    // transfers to the artist's own Stripe account below, same as before
    // contributors existed. Best-effort: a failure here shouldn't block the
    // purchase record or the artist's transfer, so log and move on.
    try {
      const { data: contributors } = await supabase
        .from("contributors")
        .select("id, percentage")
        .eq("track_id", trackId);

      if (contributors && contributors.length > 0) {
        const payoutRows = contributors.map((contributor) => ({
          contributor_id: contributor.id,
          purchase_id: insertedPurchase.id,
          amount_owed_cents: Math.round((Number(artistPayoutCents) * Number(contributor.percentage)) / 100),
          status: "owed" as const,
        }));

        const { error: payoutError } = await supabase.from("contributor_payouts").insert(payoutRows);
        if (payoutError) {
          console.error("Failed to record contributor payouts:", payoutError.message);
        }
      }
    } catch (contributorErr: any) {
      console.error("Contributor payout lookup failed:", contributorErr.message);
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
