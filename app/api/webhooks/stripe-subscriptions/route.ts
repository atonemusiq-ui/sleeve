import { stripe } from "@/lib/stripe/server";
import { transferArtistPayout } from "@/lib/stripe/payouts";
import { commissionCents, payoutCents, planOf } from "@/lib/plans";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createNotification } from "@/lib/notifications";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

// A separate webhook destination from app/api/webhooks/stripe/route.ts,
// same reasoning as that file's second "refunds & disputes" destination:
// Super Fan subscription lifecycle events (customer.subscription.*) are
// unrelated to one-time purchases, so they get their own destination in the
// Stripe Dashboard, subscribed to customer.subscription.created/updated/
// deleted, signed with its own STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS secret.
export const runtime = "nodejs";

// `current_period_end` lives on each subscription ITEM, not on the parent
// Subscription, in the Stripe API version this project pins (2026-08-26.dahlia
// -- see lib/stripe/server.ts): a subscription can bill its items on different
// cadences, so there's no single period end on the subscription itself. A
// Super Fan subscription only ever has the one $9/month item (see
// app/actions/superfan.ts), so that item's period end IS the subscription's;
// the max() is only so a future multi-item plan reports the furthest-out end
// rather than whichever item happens to come back first. Returns null rather
// than a bogus epoch date if Stripe sends no items -- artist_subscriptions
// .current_period_end is nullable (supabase/schema.sql), so recording the
// subscription still succeeds.
function currentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const ends = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((end): end is number => typeof end === "number");

  if (!ends.length) {
    console.error(
      `Subscription ${subscription.id} has no item with a current_period_end — recording it without one.`
    );
    return null;
  }

  return new Date(Math.max(...ends) * 1000).toISOString();
}

// The PaymentIntent that actually paid an invoice, which is what
// transferArtistPayout needs to tie the artist's transfer to the original
// charge. In the API version this project pins there is no `invoice
// .payment_intent` any more -- an invoice has a list of InvoicePayments, each
// pointing at a payment intent (or, for older charge-only payments, a charge).
// The list usually isn't expanded on a webhook payload, so fall back to
// fetching it. Returns null if the invoice was settled some other way (credit
// balance, a $0 proration), in which case there's nothing to transfer out of.
async function invoicePaymentIntentId(invoice: Stripe.Invoice): Promise<string | null> {
  const fromEvent = (invoice.payments?.data ?? [])
    .map((payment) => payment.payment?.payment_intent)
    .find((intent) => Boolean(intent));

  if (fromEvent) {
    return typeof fromEvent === "string" ? fromEvent : fromEvent.id;
  }

  try {
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 10 });
    const intent = payments.data
      .map((payment) => payment.payment?.payment_intent)
      .find((candidate) => Boolean(candidate));

    if (!intent) return null;

    return typeof intent === "string" ? intent : intent.id;
  } catch (err: any) {
    console.error(`Could not list payments for invoice ${invoice.id}:`, err.message);
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS is not set.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Subscription webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // A new subscription just started (checkout completed). The row's own
  // unique (fan_id, artist_id) constraint (supabase/schema.sql) makes this
  // safe to redeliver -- a redelivered event upserts onto the same row
  // rather than creating a duplicate.
  if (event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata ?? {};

        if (metadata.type === "artist_plan_subscription") {
                const artistId = metadata.artist_id;
                const plan = metadata.plan;

                if (!artistId || !plan) {
                          console.error("Plan subscription webhook missing expected metadata:", metadata);
                          return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
                }

                const { error } = await supabase
                  .from("artists")
                  .update({
                              plan,
                              plan_subscription_id: subscription.id,
                              plan_updated_at: new Date().toISOString(),
                  })
                  .eq("id", artistId);

                if (error) {
                          console.error("Failed to record artist plan subscription:", error.message);
                          return NextResponse.json({ error: "Database error" }, { status: 500 });
                }

                return NextResponse.json({ received: true });
        }

    if (metadata.type !== "superfan_subscription") {
      return NextResponse.json({ received: true });
    }

    const artistId = metadata.artist_id;
    const fanId = metadata.fan_id;
    const referredByFanId = metadata.referred_by_fan_id ?? null;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

    if (!artistId || !fanId) {
      console.error("Subscription webhook missing expected metadata:", metadata);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const { error } = await supabase
      .from("artist_subscriptions")
      .upsert(
        {
          fan_id: fanId,
          artist_id: artistId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          status: subscription.status,
          current_period_end: currentPeriodEnd(subscription),
          referred_by_fan_id: referredByFanId,
        },
        { onConflict: "fan_id,artist_id" }
      );

    // referred_by_fan_id is the one column here fed by a value from outside:
    // a `?ref=` link. startSuperFanCheckout drops anything that isn't a UUID,
    // but a well-formed id pointing at no profile still fails the foreign key
    // (23503), and an older in-flight subscription may carry a malformed one
    // (22P02). Either would 500 this event and leave the fan paying with no
    // subscription row at all, so the referrer -- which nothing pays out on
    // yet -- is dropped and the subscription recorded without it.
    if (error && ((error as any).code === "23503" || (error as any).code === "22P02")) {
      console.error(
        `Super Fan subscription ${subscription.id} had an unusable referred_by_fan_id (${referredByFanId}); recording without it.`
      );

      const { error: retryError } = await supabase
        .from("artist_subscriptions")
        .upsert(
          {
            fan_id: fanId,
            artist_id: artistId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: customerId,
            status: subscription.status,
            current_period_end: currentPeriodEnd(subscription),
            referred_by_fan_id: null,
          },
          { onConflict: "fan_id,artist_id" }
        );

      if (retryError) {
        console.error("Failed to record Super Fan subscription:", retryError.message);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    } else if (error) {
      console.error("Failed to record Super Fan subscription:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const { data: artist } = await supabase
      .from("artists")
      .select("user_id")
      .eq("id", artistId)
      .single();

    if (artist?.user_id) {
      await createNotification(supabase, {
        userId: artist.user_id,
        type: "superfan",
        title: "New Super Fan!",
        body: "Someone just became a Super Fan for $9/month.",
        link: "/dashboard",
      });
    }

    return NextResponse.json({ received: true });
  }

  // Renewal, plan change, or a payment failure moving the subscription into
  // past_due/unpaid -- keep status and the current period end in sync so
  // exclusive-content access (checked against this table) reflects reality.
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;

        if ((subscription.metadata ?? {}).type === "artist_plan_subscription") {
                // Held through past_due deliberately -- the plan only changes when
                // Stripe actually ends the subscription (customer.subscription.deleted
                // below), not on a payment hiccup that might still resolve.
                return NextResponse.json({ received: true });
        }

    const { error } = await supabase
      .from("artist_subscriptions")
      .update({
        status: subscription.status,
        current_period_end: currentPeriodEnd(subscription),
      })
      .eq("stripe_subscription_id", subscription.id);

    if (error) {
      console.error("Failed to update Super Fan subscription:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  }

  // Canceled (by the fan, or after repeated failed payments). Flips status
  // to 'canceled' rather than deleting the row, so the fan/artist keep the
  // history of the relationship (when it started, how long it lasted).
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

        if ((subscription.metadata ?? {}).type === "artist_plan_subscription") {
                const { error } = await supabase
                  .from("artists")
                  .update({
                              plan: "free",
                              plan_subscription_id: null,
                              plan_updated_at: new Date().toISOString(),
                  })
                  .eq("plan_subscription_id", subscription.id);

                if (error) {
                          console.error("Failed to downgrade artist plan to free:", error.message);
                          return NextResponse.json({ error: "Database error" }, { status: 500 });
                }

                return NextResponse.json({ received: true });
        }

    const { error } = await supabase
      .from("artist_subscriptions")
      .update({ status: "canceled" })
      .eq("stripe_subscription_id", subscription.id);

    if (error) {
      console.error("Failed to cancel Super Fan subscription:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  }

  // Every paid subscription invoice -- the first one at signup
  // (billing_reason 'subscription_create') and each monthly renewal after it.
  // This is what actually pays the artist: the $9 lands in the platform's own
  // Stripe balance, and nothing else moves their share to their connected
  // account. Same 20% platform cut as a track sale or a gift.
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionDetails = invoice.parent?.subscription_details ?? null;
    const metadata = subscriptionDetails?.metadata ?? {};

    // Invoices from anything other than a Super Fan subscription are not
    // ours to pay out. The metadata here is the snapshot Stripe takes of the
    // subscription's own metadata when the invoice is finalized, so it
    // carries what startSuperFanCheckout set.
    if (metadata.type !== "superfan_subscription") {
      return NextResponse.json({ received: true });
    }

    const artistId = metadata.artist_id;
    const fanId = metadata.fan_id ?? null;
    const subscriptionId =
      typeof subscriptionDetails?.subscription === "string"
        ? subscriptionDetails.subscription
        : subscriptionDetails?.subscription?.id ?? null;
    const amountCents = invoice.amount_paid;

    if (!artistId) {
      console.error("Subscription invoice missing artist_id metadata:", metadata);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // A $0 invoice (a full-coupon month, a proration that nets out) is a
    // real event with nothing to pay out.
    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ received: true, note: "nothing to pay out" });
    }

    // subscription_payouts.stripe_invoice_id is unique, so the insert below
    // can't double-record -- but on its own that wouldn't stop a redelivered
    // event firing a second transfer, so check before touching Stripe.
    const { data: existingPayout } = await supabase
      .from("subscription_payouts")
      .select("id")
      .eq("stripe_invoice_id", invoice.id)
      .limit(1);

    if (existingPayout && existingPayout.length > 0) {
      return NextResponse.json({ received: true, note: "already processed" });
    }

    const { data: artist } = await supabase
      .from("artists")
      .select("user_id, stripe_account_id, plan")
      .eq("id", artistId)
      .single();

    // Super Fan money is artist revenue like any sale, so it takes the
    // artist's plan rate rather than a rate of its own. Read at the moment
    // the invoice is paid, not when the fan first subscribed: a renewal
    // twelve months in should settle at whatever plan the artist is on now.
    const plan = planOf((artist as any)?.plan);
    const platformFeeCents = commissionCents(amountCents, plan);
    const artistPayoutCents = payoutCents(amountCents, plan);
    const paymentIntentId = await invoicePaymentIntentId(invoice);

    const artistStripeAccountId = (artist as any)?.stripe_account_id ?? null;
    const artistUserId = (artist as any)?.user_id ?? null;

    // Recorded before the transfer is attempted, so a payout that can't go
    // out still leaves a row saying the artist is owed this month rather than
    // vanishing. status is corrected to 'paid' once the transfer lands.
    const { data: insertedPayout, error: payoutError } = await supabase
      .from("subscription_payouts")
      .insert({
        artist_id: artistId,
        fan_id: fanId,
        stripe_subscription_id: subscriptionId,
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: amountCents,
        platform_fee_cents: platformFeeCents,
        artist_payout_cents: artistPayoutCents,
        status: "unpaid",
      })
      .select("id")
      .single();

    if (payoutError) {
      if ((payoutError as any).code === "23505") {
        return NextResponse.json({ received: true, note: "already processed" });
      }
      console.error("Failed to record subscription payout:", payoutError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!artistStripeAccountId || !paymentIntentId) {
      // Same judgment call as the one-time purchase webhook: the row is
      // recorded and a Stripe retry can't conjure a connected account or a
      // payment intent, so log it for a manual payout instead of 500'ing into
      // a redelivery loop. The row stays 'unpaid' and is the list of what's
      // owed.
      console.error(
        "Super Fan invoice paid but the artist was not paid out:",
        !artistStripeAccountId
          ? `artist ${artistId} has no linked stripe_account_id`
          : `invoice ${invoice.id} has no payment intent to transfer from`
      );
    } else {
      try {
        const transfer = await transferArtistPayout(
          paymentIntentId,
          artistPayoutCents,
          artistStripeAccountId,
          `superfan_${artistId}`
        );
        await supabase
          .from("subscription_payouts")
          .update({ stripe_transfer_id: transfer.id, status: "paid" })
          .eq("id", insertedPayout.id);
      } catch (transferError: any) {
        console.error("Failed to transfer Super Fan payout:", transferError.message);
        await supabase
          .from("subscription_payouts")
          .update({ status: "failed" })
          .eq("id", insertedPayout.id);
      }
    }

    // Only on renewals — the signup itself already notified the artist from
    // the customer.subscription.created branch above, and two notifications
    // for the same event would just be noise.
    if (artistUserId && invoice.billing_reason !== "subscription_create") {
      await createNotification(supabase, {
        userId: artistUserId,
        type: "superfan_renewal",
        title: "Super Fan renewed",
        body: `$${(artistPayoutCents / 100).toFixed(2)} from a Super Fan's monthly support.`,
        link: "/dashboard",
      });
    }

    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
