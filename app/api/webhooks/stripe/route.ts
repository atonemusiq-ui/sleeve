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
      console.error("Failed to record purchase:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
