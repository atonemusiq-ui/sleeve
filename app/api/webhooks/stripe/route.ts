import { stripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

// Stripe needs the raw, unparsed request body to verify the webhook
// signature, so we don't let Next.js parse it as JSON first.
export const runtime = "nodejs";

type Supabase = ReturnType<typeof createServiceRoleClient>;

// Splits `totalCents` across `weights` proportionally, with the rounding
// remainder assigned to the last entry so the parts always sum to exactly
// `totalCents` (never off by a cent from float rounding). Used to divide an
// album's flat bundle price across its constituent tracks, weighted by each
// track's own price_cents — a $10, 4-track album where one track normally
// sells for $5 and the other three for $1 each ($8 total list price) gives
// that track 5/8 of the $10, not an even quarter.
function splitProportionally(totalCents: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);

  if (weightSum <= 0) {
    // No usable weights (e.g. every track priced $0) — fall back to an even
    // split rather than dividing by zero.
    const n = weights.length;
    const base = Math.floor(totalCents / n);
    const remainder = totalCents - base * n;
    return weights.map((_, i) => base + (i < remainder ? 1 : 0));
  }

  const shares = weights.map((w) => Math.floor((totalCents * w) / weightSum));
  const allocated = shares.reduce((a, b) => a + b, 0);
  shares[shares.length - 1] += totalCents - allocated;
  return shares;
}

// Best-effort contributor royalty split for one purchase row — identical to
// what the single-track path already did, just factored out so the album
// path (which does this once per track) can reuse it. A failure here
// shouldn't block the purchase record or the artist's transfer, so callers
// wrap this in try/catch and just log.
async function recordContributorPayouts(
  supabase: Supabase,
  trackId: string,
  purchaseId: string,
  artistPayoutCents: number
) {
  const { data: contributors } = await supabase
    .from("contributors")
    .select("id, percentage")
    .eq("track_id", trackId);

  if (!contributors || contributors.length === 0) return;

  const payoutRows = contributors.map((contributor) => ({
    contributor_id: contributor.id,
    purchase_id: purchaseId,
    amount_owed_cents: Math.round((artistPayoutCents * Number(contributor.percentage)) / 100),
    status: "owed" as const,
  }));

  const { error: payoutError } = await supabase.from("contributor_payouts").insert(payoutRows);
  if (payoutError) {
    console.error("Failed to record contributor payouts:", payoutError.message);
  }
}

// Transfers `amountCents` to `stripeAccountId` out of the specific charge
// that funded this payment (Stripe's recommended "separate charges and
// transfers" pattern), rather than drawing from the platform's general
// available balance. Shared by both the single-track and album paths — an
// album purchase still makes exactly one transfer, for the combined payout
// across all its tracks, not one per track.
async function transferArtistPayout(
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

  await stripe.transfers.create({
    amount: amountCents,
    currency: "usd",
    destination: stripeAccountId,
    source_transaction: chargeId,
    transfer_group: transferGroup,
  });
}

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

    const trackId = session.metadata?.track_id ?? null;
    const albumId = session.metadata?.album_id ?? null;
    const fanId = session.metadata?.fan_id ?? null;
    const amountCents = session.metadata?.amount_cents;
    const buyerEmail = session.customer_details?.email ?? null;
    const buyerPhone = session.customer_details?.phone ?? null;
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    if ((!trackId && !albumId) || !amountCents) {
      console.error("Webhook missing expected metadata:", session.metadata);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Stripe can and does redeliver the same event more than once (retries,
    // duplicate delivery). Without a check here, a redelivery would insert
    // purchase row(s) for the same payment AND run the transfer below a
    // second time — double-paying the artist out of the platform's Stripe
    // balance. Guard on the payment intent id before doing anything else —
    // an album purchase inserts multiple rows sharing one payment_intent_id
    // (see the composite unique index in supabase/schema.sql), so this only
    // needs to find ANY row for that intent, not a specific track's row.
    if (paymentIntentId) {
      const { data: existing } = await supabase
        .from("purchases")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json({ received: true, note: "already processed" });
      }
    }

    if (albumId) {
      // ---- Album purchase: one purchases row per track, revenue split
      // proportional to each track's own price_cents, one combined Stripe
      // transfer for the whole album's artist payout. ----
      const { data: album, error: albumError } = await supabase
        .from("albums")
        .select("id, artists ( id, stripe_account_id )")
        .eq("id", albumId)
        .single();

      if (albumError || !album) {
        console.error("Webhook album lookup failed:", albumError?.message ?? `album ${albumId} not found`);
        return NextResponse.json({ error: "Album not found" }, { status: 400 });
      }

      const { data: albumTrackRows, error: tracksError } = await supabase
        .from("album_tracks")
        .select("track_id, tracks ( price_cents )")
        .eq("album_id", albumId)
        .order("track_order", { ascending: true });

      if (tracksError || !albumTrackRows || albumTrackRows.length === 0) {
        console.error(
          "Webhook album_tracks lookup failed:",
          tracksError?.message ?? `album ${albumId} has no tracks`
        );
        return NextResponse.json({ error: "Album has no tracks" }, { status: 400 });
      }

      const trackIds = albumTrackRows.map((row) => row.track_id);
      const weights = albumTrackRows.map((row) => Number((row.tracks as any)?.price_cents ?? 0));
      const amountShares = splitProportionally(Number(amountCents), weights);

      const rows = trackIds.map((id, i) => {
        const rowAmountCents = amountShares[i];
        const rowPlatformFeeCents = Math.round(rowAmountCents * 0.2);
        const rowArtistPayoutCents = rowAmountCents - rowPlatformFeeCents;
        return {
          track_id: id,
          album_id: albumId,
          fan_id: fanId,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          amount_cents: rowAmountCents,
          platform_fee_cents: rowPlatformFeeCents,
          artist_payout_cents: rowArtistPayoutCents,
          stripe_payment_intent_id: paymentIntentId,
          status: "complete" as const,
        };
      });

      const { data: insertedPurchases, error: insertError } = await supabase
        .from("purchases")
        .insert(rows)
        .select("id, track_id, artist_payout_cents");

      if (insertError) {
        // A unique-violation here (code 23505) means we lost a race against
        // another delivery of the same event between the check above and
        // this insert — that's still "already processed", not a real
        // failure, so don't 500 (which would just trigger yet another retry).
        if ((insertError as any).code === "23505") {
          return NextResponse.json({ received: true, note: "already processed" });
        }
        console.error("Failed to record album purchase:", insertError.message);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      // Contributor royalty split, per track — bookkeeping only, doesn't
      // move any money on its own. Best-effort: log and move on.
      try {
        for (const purchase of insertedPurchases ?? []) {
          await recordContributorPayouts(supabase, purchase.track_id, purchase.id, purchase.artist_payout_cents);
        }
      } catch (contributorErr: any) {
        console.error("Contributor payout lookup failed:", contributorErr.message);
      }

      const artistStripeAccountId = (album as any).artists?.stripe_account_id;
      const totalArtistPayoutCents = (insertedPurchases ?? []).reduce(
        (sum, p) => sum + p.artist_payout_cents,
        0
      );

      if (!artistStripeAccountId) {
        console.error(
          "No connected Stripe account found for this album's artist — purchase recorded but artist was not paid:",
          `album ${albumId} has no linked stripe_account_id`
        );
      } else if (paymentIntentId) {
        try {
          await transferArtistPayout(paymentIntentId, totalArtistPayoutCents, artistStripeAccountId, albumId);
        } catch (transferError: any) {
          console.error("Failed to transfer artist payout:", transferError.message);
        }
      }

      return NextResponse.json({ received: true });
    }

    // ---- Single-track purchase (unchanged from before albums existed). ----
    const platformFeeCents = session.metadata?.platform_fee_cents;
    const artistPayoutCents = session.metadata?.artist_payout_cents;

    if (!platformFeeCents || !artistPayoutCents) {
      console.error("Webhook missing expected metadata:", session.metadata);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
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
      if ((error as any).code === "23505") {
        return NextResponse.json({ received: true, note: "already processed" });
      }
      console.error("Failed to record purchase:", error.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    try {
      await recordContributorPayouts(supabase, trackId as string, insertedPurchase.id, Number(artistPayoutCents));
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
        await transferArtistPayout(
          paymentIntentId,
          Number(artistPayoutCents),
          artistStripeAccountId,
          trackId as string
        );
      } catch (transferError: any) {
        // Same reasoning as above: log and move on rather than 500'ing and
        // triggering a retry that would try to insert a duplicate purchase.
        console.error("Failed to transfer artist payout:", transferError.message);
      }
    }
  }

  return NextResponse.json({ received: true });
}
