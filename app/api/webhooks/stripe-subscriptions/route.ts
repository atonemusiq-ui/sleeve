import { stripe } from "@/lib/stripe/server";
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

    if (error) {
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

  return NextResponse.json({ received: true });
}
