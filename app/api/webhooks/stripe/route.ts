import { stripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createNotification } from "@/lib/notifications";
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

// Splits a track's contributor royalties out of the artist's payout for one
// purchase. A contributor who has connected Stripe (see
// app/contributor-onboard/[token] and app/actions/contributor-connect.ts)
// gets paid directly out of the same charge as the artist's own transfer
// (Stripe's "separate charges and transfers" pattern, same as
// transferArtistPayout below) — their contributor_payouts row is recorded
// 'paid' immediately, with the transfer id attached so a refund can reverse
// it later. A contributor who hasn't connected yet still gets the original
// bookkeeping-only 'owed' row, unchanged from before this feature — the
// artist settles that one by hand, and keeps receiving that contributor's
// share themselves. Returns the total cents actually diverted to onboarded
// contributors, so the caller pays the artist only the remainder.
async function payContributorsAndRecordPayouts(
  supabase: Supabase,
  paymentIntentId: string | null,
  trackId: string,
  purchaseId: string,
  artistPayoutCents: number
): Promise<number> {
  const { data: contributors } = await supabase
    .from("contributors")
    .select("id, percentage, stripe_account_id")
    .eq("track_id", trackId);

  if (!contributors || contributors.length === 0) return 0;

  let divertedCents = 0;

  for (const contributor of contributors) {
    const amountCents = Math.round((artistPayoutCents * Number(contributor.percentage)) / 100);
    if (amountCents <= 0) continue;

    if (contributor.stripe_account_id && paymentIntentId) {
      try {
        const transfer = await transferArtistPayout(
          paymentIntentId,
          amountCents,
          contributor.stripe_account_id,
          purchaseId
        );
        divertedCents += amountCents;
        const { error: payoutError } = await supabase.from("contributor_payouts").insert({
          contributor_id: contributor.id,
          purchase_id: purchaseId,
          amount_owed_cents: amountCents,
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_transfer_id: transfer.id,
        });
        if (payoutError) console.error("Failed to record paid contributor payout:", payoutError.message);
        continue;
      } catch (transferErr: any) {
        // Falls through to the manual-pay ledger below — better to owe them
        // visibly than to silently drop their share because their connected
        // account couldn't yet receive a transfer for some reason.
        console.error(`Failed to pay contributor ${contributor.id} directly:`, transferErr.message);
      }
    }

    const { error: payoutError } = await supabase.from("contributor_payouts").insert({
      contributor_id: contributor.id,
      purchase_id: purchaseId,
      amount_owed_cents: amountCents,
      status: "owed",
    });
    if (payoutError) console.error("Failed to record contributor payout:", payoutError.message);
  }

  return divertedCents;
}

// Transfers `amountCents` to `stripeAccountId` out of the specific charge
// that funded this payment (Stripe's recommended "separate charges and
// transfers" pattern), rather than drawing from the platform's general
// available balance. Shared by both the single-track and album paths — an
// album purchase still makes exactly one transfer, for the combined payout
// across all its tracks, not one per track. Returns the created Transfer so
// callers can persist its id on the purchase row(s) — that id is what lets a
// later refund/dispute reverse this exact transfer (see
// reverseArtistPayoutsAndVoidContributors below) instead of guessing.
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

  return stripe.transfers.create({
    amount: amountCents,
    currency: "usd",
    destination: stripeAccountId,
    source_transaction: chargeId,
    transfer_group: transferGroup,
  });
}

// Claws back the artist's payout when a purchase is refunded or a dispute is
// lost. Groups by transfer id first so an album's single combined transfer
// (see transferArtistPayout above) is reversed once for its full amount
// rather than once per track. A contributor payout still sitting at 'owed'
// for one of these purchases is voided — that money was never actually sent
// anywhere yet, so the ledger just drops it. A payout already 'paid' came
// out of the artist's own pocket at that point, not the platform's Stripe
// balance, so there's nothing here to claw back from the contributor; it's
// left as-is and worth a manual look if it happens often.
async function reverseArtistPayoutsAndVoidContributors(
  supabase: Supabase,
  purchases: {
    id: string;
    stripe_transfer_id: string | null;
    artist_payout_cents: number | null;
    artist_net_payout_cents?: number | null;
  }[]
) {
  // Grouped by transfer id so an album's single combined transfer is
  // reversed once for its full amount rather than once per track. Uses the
  // net amount actually sent to the artist (artist_net_payout_cents) where
  // it's set — a purchase made before this column existed, or one with no
  // Stripe-onboarded contributors, falls back to the gross artist_payout_cents,
  // which is the same number in that case anyway.
  const byTransfer = new Map<string, number>();
  for (const p of purchases) {
    if (!p.stripe_transfer_id) continue;
    const amount = p.artist_net_payout_cents ?? p.artist_payout_cents ?? 0;
    byTransfer.set(p.stripe_transfer_id, (byTransfer.get(p.stripe_transfer_id) ?? 0) + amount);
  }

  for (const [transferId, amount] of byTransfer) {
    if (amount <= 0) continue;
    try {
      await stripe.transfers.createReversal(transferId, { amount });
    } catch (err: any) {
      // Could mean it's already been reversed (e.g. a redelivered event), or
      // the connected account can't cover it. Either way, log loudly instead
      // of silently swallowing it — this is real money to reconcile by hand
      // in the Stripe dashboard if the automatic path failed.
      console.error(`Failed to reverse transfer ${transferId}:`, err.message);
    }
  }

  const purchaseIds = purchases.map((p) => p.id);
  if (!purchaseIds.length) return;

  // A contributor share still sitting at 'owed' was never actually sent
  // anywhere — void it outright.
  await supabase
    .from("contributor_payouts")
    .update({ status: "voided" })
    .in("purchase_id", purchaseIds)
    .eq("status", "owed");

  // A contributor share that WAS already paid directly via Stripe (see
  // payContributorsAndRecordPayouts) came out of the same charge as the
  // artist's own cut, so it needs the same reversal treatment, not just a
  // status flip.
  const { data: paidContributorPayouts } = await supabase
    .from("contributor_payouts")
    .select("id, stripe_transfer_id")
    .in("purchase_id", purchaseIds)
    .eq("status", "paid")
    .not("stripe_transfer_id", "is", null);

  for (const payout of paidContributorPayouts ?? []) {
    try {
      await stripe.transfers.createReversal(payout.stripe_transfer_id as string);
      await supabase.from("contributor_payouts").update({ status: "voided" }).eq("id", payout.id);
    } catch (err: any) {
      console.error(`Failed to reverse contributor transfer ${payout.stripe_transfer_id}:`, err.message);
    }
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Two Stripe event destinations point at this same URL: the original
  // "Fyby production" one (checkout.session.completed, etc.) and a second
  // "Fyby production - refunds & disputes" one added for charge.refunded /
  // charge.dispute.created / charge.dispute.closed — Stripe's dashboard
  // rejected adding those three events to the original destination because
  // it uses the newer "thin" payload style, which those classic events
  // don't support ("This event is not compatible with this destination"),
  // so a second, "Snapshot"-style destination was the only way to receive
  // them. Each destination signs with its own secret, so a signature that
  // fails against the primary secret is tried against the second one before
  // being rejected outright.
  const webhookSecrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_REFUNDS,
  ].filter((s): s is string => Boolean(s));

  let event: Stripe.Event | null = null;
  let verificationError: any = null;
  for (const secret of webhookSecrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
      verificationError = null;
      break;
    } catch (err: any) {
      verificationError = err;
    }
  }

  if (!event) {
    console.error("Webhook signature verification failed:", verificationError?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // The bio video feature (app/actions/video.ts's startVideoUnlockCheckout)
    // is a flat Fyby platform fee, not a fan purchase — no track/album, no
    // artist payout transfer, just unlocking a tier on the artist's own row.
    // Handled before the track/album branches below since it has neither
    // track_id nor album_id in its metadata.
    if (session.metadata?.type === "video_unlock") {
      const artistId = session.metadata?.artist_id ?? null;
      const tier = session.metadata?.tier ?? null;

      if (!artistId || !tier) {
        console.error("Video-unlock webhook missing expected metadata:", session.metadata);
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      const supabase = createServiceRoleClient();
      const { error } = await supabase
        .from("artists")
        .update({ video_tier: tier, video_unlocked_at: new Date().toISOString() })
        .eq("id", artistId);

      if (error) {
        console.error("Failed to unlock video tier:", error.message);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      return NextResponse.json({ received: true });
    }

    // Same shape as the video_unlock branch above: a flat Fyby review fee,
    // not a fan purchase — no artist payout transfer. Moves the track into
    // the admin review queue (app/admin/verifications/page.tsx) now that
    // payment is actually confirmed; the note itself was already saved by
    // app/actions/verification.ts's startVerificationCheckout ahead of
    // checkout.
    if (session.metadata?.type === "track_verification") {
      const verifyTrackId = session.metadata?.track_id ?? null;

      if (!verifyTrackId) {
        console.error("Verification webhook missing expected metadata:", session.metadata);
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      const supabase = createServiceRoleClient();
      const { error } = await supabase
        .from("tracks")
        .update({ verification_status: "pending", verification_requested_at: new Date().toISOString() })
        .eq("id", verifyTrackId);

      if (error) {
        console.error("Failed to record verification request:", error.message);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      return NextResponse.json({ received: true });
    }

    // A one-time monetary gift from a fan straight to an artist (see
    // app/actions/superfan.ts's startGiftCheckout). Handled up here with the
    // two branches above because it carries neither track_id nor album_id —
    // but unlike them it's a real fan payment that owes the artist money, so
    // it takes the same 20% platform cut and the same Stripe transfer as a
    // track sale rather than staying in the platform's balance.
    if (session.metadata?.type === "gift") {
      const giftArtistId = session.metadata?.artist_id ?? null;
      const giftFanId = session.metadata?.fan_id ?? null;
      const giftAmountCents = Number(session.metadata?.amount_cents);
      const giftMessage = session.metadata?.gift_message ?? null;
      const giftPaymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : null;

      if (!giftArtistId || !giftAmountCents) {
        console.error("Gift webhook missing expected metadata:", session.metadata);
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      const supabase = createServiceRoleClient();

      // Same redelivery reasoning as the purchase branch below: the unique
      // stripe_payment_intent_id on gifts (supabase/schema.sql) already stops
      // a redelivered event inserting a second row, but on its own it
      // wouldn't stop a second transfer going out — so bail before touching
      // Stripe at all.
      if (giftPaymentIntentId) {
        const { data: existingGift } = await supabase
          .from("gifts")
          .select("id")
          .eq("stripe_payment_intent_id", giftPaymentIntentId)
          .limit(1);

        if (existingGift && existingGift.length > 0) {
          return NextResponse.json({ received: true, note: "already processed" });
        }
      }

      // Same 20% cut as a track or album sale — kept in step with
      // app/actions/checkout.ts, which computes the fee for those before
      // checkout rather than here.
      const giftPlatformFeeCents = Math.round(giftAmountCents * 0.2);
      const giftArtistPayoutCents = giftAmountCents - giftPlatformFeeCents;

      const { data: insertedGift, error: giftError } = await supabase
        .from("gifts")
        .insert({
          fan_id: giftFanId,
          artist_id: giftArtistId,
          amount_cents: giftAmountCents,
          message: giftMessage,
          stripe_payment_intent_id: giftPaymentIntentId,
          platform_fee_cents: giftPlatformFeeCents,
          artist_payout_cents: giftArtistPayoutCents,
        })
        .select("id")
        .single();

      if (giftError) {
        if ((giftError as any).code === "23505") {
          return NextResponse.json({ received: true, note: "already processed" });
        }
        console.error("Failed to record gift:", giftError.message);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      const { data: giftArtist, error: giftArtistError } = await supabase
        .from("artists")
        .select("user_id, stripe_account_id")
        .eq("id", giftArtistId)
        .single();

      const giftArtistStripeAccountId = (giftArtist as any)?.stripe_account_id;
      const giftArtistUserId = (giftArtist as any)?.user_id ?? null;

      if (giftArtistError || !giftArtistStripeAccountId) {
        // Same judgment call as the track branch below: the gift is already
        // recorded and a Stripe retry can't fix a missing connected account,
        // so log it loudly for a manual payout instead of 500'ing into a
        // redelivery loop.
        console.error(
          "No connected Stripe account found for this gift's artist — gift recorded but artist was not paid:",
          giftArtistError?.message ?? `artist ${giftArtistId} has no linked stripe_account_id`
        );
      } else if (giftPaymentIntentId && giftArtistPayoutCents > 0) {
        try {
          const transfer = await transferArtistPayout(
            giftPaymentIntentId,
            giftArtistPayoutCents,
            giftArtistStripeAccountId,
            `gift_${giftArtistId}`
          );
          await supabase
            .from("gifts")
            .update({ stripe_transfer_id: transfer.id })
            .eq("id", insertedGift.id);
        } catch (transferError: any) {
          console.error("Failed to transfer gift payout:", transferError.message);
        }
      }

      if (giftArtistUserId) {
        await createNotification(supabase, {
          userId: giftArtistUserId,
          type: "gift",
          title: "You received a gift!",
          body: `$${(giftArtistPayoutCents / 100).toFixed(2)} from a fan.${
            giftMessage ? ` They said: "${giftMessage}"` : ""
          }`,
          link: "/dashboard",
        });
      }

      return NextResponse.json({ received: true });
    }

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
        .select("id, title, artists ( id, user_id, stripe_account_id )")
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

      // Contributor royalty split, per track — pays any Stripe-onboarded
      // contributor directly, bookkeeps the rest. Best-effort: log and move
      // on. Tracked per-purchase-row so each row's own net (gross minus what
      // was diverted for that specific track) can be stored below — an
      // album's tracks don't necessarily have the same contributors.
      const divertedByPurchase = new Map<string, number>();
      let totalDivertedCents = 0;
      try {
        for (const purchase of insertedPurchases ?? []) {
          const diverted = await payContributorsAndRecordPayouts(
            supabase,
            paymentIntentId,
            purchase.track_id,
            purchase.id,
            purchase.artist_payout_cents
          );
          divertedByPurchase.set(purchase.id, diverted);
          totalDivertedCents += diverted;
        }
      } catch (contributorErr: any) {
        console.error("Contributor payout lookup failed:", contributorErr.message);
      }

      const artistStripeAccountId = (album as any).artists?.stripe_account_id;
      const artistUserId = (album as any).artists?.user_id ?? null;
      const totalArtistPayoutCents = (insertedPurchases ?? []).reduce(
        (sum, p) => sum + p.artist_payout_cents,
        0
      );
      const totalArtistNetPayoutCents = totalArtistPayoutCents - totalDivertedCents;

      if (!artistStripeAccountId) {
        console.error(
          "No connected Stripe account found for this album's artist — purchase recorded but artist was not paid:",
          `album ${albumId} has no linked stripe_account_id`
        );
      } else if (paymentIntentId && totalArtistNetPayoutCents > 0) {
        try {
          const transfer = await transferArtistPayout(
            paymentIntentId,
            totalArtistNetPayoutCents,
            artistStripeAccountId,
            albumId
          );
          for (const purchase of insertedPurchases ?? []) {
            const net = purchase.artist_payout_cents - (divertedByPurchase.get(purchase.id) ?? 0);
            await supabase
              .from("purchases")
              .update({ stripe_transfer_id: transfer.id, artist_net_payout_cents: net })
              .eq("id", purchase.id);
          }
        } catch (transferError: any) {
          console.error("Failed to transfer artist payout:", transferError.message);
        }
      }

      if (artistUserId) {
        await createNotification(supabase, {
          userId: artistUserId,
          type: "sale",
          title: `New sale: ${(album as any).title ?? "an album"}`,
          body: `$${(totalArtistPayoutCents / 100).toFixed(2)} from a fan.`,
          link: "/dashboard/catalog",
        });
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

    let divertedCents = 0;
    try {
      divertedCents = await payContributorsAndRecordPayouts(
        supabase,
        paymentIntentId,
        trackId as string,
        insertedPurchase.id,
        Number(artistPayoutCents)
      );
    } catch (contributorErr: any) {
      console.error("Contributor payout lookup failed:", contributorErr.message);
    }

    // The purchase is recorded, but the payment itself landed entirely in
    // this platform's own Stripe balance — nothing above has paid the
    // artist their share yet. Look up the artist's connected account for
    // this track and transfer their cut over now, net of anything just paid
    // straight to a Stripe-onboarded contributor above.
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("title, artists ( user_id, stripe_account_id )")
      .eq("id", trackId)
      .single();

    const artistStripeAccountId = (track as any)?.artists?.stripe_account_id;
    const artistUserId = (track as any)?.artists?.user_id ?? null;
    const artistNetPayoutCents = Number(artistPayoutCents) - divertedCents;

    if (trackError || !artistStripeAccountId) {
      // Don't fail the webhook over this — the purchase is already
      // recorded, and Stripe would just retry redelivery (risking a
      // duplicate purchase row) for a problem a retry can't fix anyway.
      // Log it loudly so the payout can be investigated/sent manually.
      console.error(
        "No connected Stripe account found for this track's artist — purchase recorded but artist was not paid:",
        trackError?.message ?? `track ${trackId} has no linked stripe_account_id`
      );
    } else if (paymentIntentId && artistNetPayoutCents > 0) {
      try {
        const transfer = await transferArtistPayout(
          paymentIntentId,
          artistNetPayoutCents,
          artistStripeAccountId,
          trackId as string
        );
        await supabase
          .from("purchases")
          .update({ stripe_transfer_id: transfer.id, artist_net_payout_cents: artistNetPayoutCents })
          .eq("id", insertedPurchase.id);
      } catch (transferError: any) {
        // Same reasoning as above: log and move on rather than 500'ing and
        // triggering a retry that would try to insert a duplicate purchase.
        console.error("Failed to transfer artist payout:", transferError.message);
      }
    }

    if (artistUserId) {
      await createNotification(supabase, {
        userId: artistUserId,
        type: "sale",
        title: `New sale: ${(track as any)?.title ?? "a track"}`,
        body: `$${(Number(artistPayoutCents) / 100).toFixed(2)} from a fan.`,
        link: "/dashboard/catalog",
      });
    }

    return NextResponse.json({ received: true });
  }

  // A fan getting their money back — full refunds only get automatic
  // treatment (see the partial-refund branch below for why). Access
  // (library + /api/stream, both already gated on status='complete') drops
  // the instant the purchase row flips to 'refunded', and the artist's
  // payout is clawed back via reverseArtistPayoutsAndVoidContributors.
  //
  // Requires "charge.refunded" to be added to this webhook endpoint's
  // subscribed events in the Stripe Dashboard — it isn't sent by default.
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;

    if (!paymentIntentId) {
      return NextResponse.json({ received: true });
    }

    const supabase = createServiceRoleClient();
    const { data: purchases } = await supabase
      .from("purchases")
      .select(
        "id, status, amount_cents, artist_payout_cents, artist_net_payout_cents, stripe_transfer_id, tracks ( artists ( user_id ) )"
      )
      .eq("stripe_payment_intent_id", paymentIntentId);

    if (!purchases || purchases.length === 0) {
      return NextResponse.json({ received: true });
    }

    const totalPurchasedCents = purchases.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
    const isFullRefund = charge.amount_refunded >= totalPurchasedCents;

    if (!isFullRefund) {
      // A partial refund doesn't cleanly map onto "which track(s) in this
      // album lost access" and a fan given a partial goodwill refund
      // usually still keeps what they bought — flagged for manual review
      // rather than guessing which access/payout to revoke.
      console.error(
        `Partial refund on payment_intent ${paymentIntentId} (${charge.amount_refunded} of ${totalPurchasedCents} cents) — needs manual review, no automatic access/payout changes made.`
      );
      return NextResponse.json({ received: true, note: "partial refund flagged for manual review" });
    }

    const stillActive = purchases.filter((p) => p.status === "complete");
    if (stillActive.length === 0) {
      // Already handled — e.g. a dispute-lost event on this same
      // payment_intent already reversed things before this event arrived.
      return NextResponse.json({ received: true, note: "already processed" });
    }

    await supabase
      .from("purchases")
      .update({ status: "refunded" })
      .in("id", stillActive.map((p) => p.id));

    await reverseArtistPayoutsAndVoidContributors(supabase, stillActive as any);

    const artistUserId = (stillActive[0] as any)?.tracks?.artists?.user_id ?? null;
    if (artistUserId) {
      await createNotification(supabase, {
        userId: artistUserId,
        type: "refund",
        title: "A sale was refunded",
        body: `$${(charge.amount_refunded / 100).toFixed(2)} was refunded to the buyer.`,
        link: "/dashboard/catalog",
      });
    }

    return NextResponse.json({ received: true });
  }

  // A chargeback has been opened. Suspend access right away rather than
  // waiting for the outcome — this is exactly the situation where the money
  // might get pulled back out of the platform's balance, so a fan shouldn't
  // keep streaming/downloading while it's unresolved. Restored to 'complete'
  // below if the dispute is later won.
  //
  // Requires "charge.dispute.created" in this webhook's subscribed events.
  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentIntentId =
      typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null;

    if (!paymentIntentId) {
      return NextResponse.json({ received: true });
    }

    const supabase = createServiceRoleClient();
    const { data: disputed } = await supabase
      .from("purchases")
      .update({ status: "disputed" })
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("status", "complete")
      .select("tracks ( artists ( user_id ) )");

    console.error(`Dispute opened on payment_intent ${paymentIntentId} — access suspended pending resolution.`);

    const artistUserId = (disputed?.[0] as any)?.tracks?.artists?.user_id ?? null;
    if (artistUserId) {
      await createNotification(supabase, {
        userId: artistUserId,
        type: "dispute",
        title: "A chargeback was opened",
        body: `$${(dispute.amount / 100).toFixed(2)} is being disputed — access is suspended until it's resolved.`,
        link: "/dashboard/catalog",
      });
    }

    return NextResponse.json({ received: true });
  }

  // The dispute has a final outcome. Won: give access back. Lost (or any
  // other closed-and-not-won outcome, e.g. "warning_closed" — treated the
  // same, conservatively) — the funds are gone for good, so this gets the
  // same refund/payout-reversal/contributor-voiding treatment as a full
  // refund above.
  //
  // Requires "charge.dispute.closed" in this webhook's subscribed events.
  if (event.type === "charge.dispute.closed") {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentIntentId =
      typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null;

    if (!paymentIntentId) {
      return NextResponse.json({ received: true });
    }

    const supabase = createServiceRoleClient();

    if (dispute.status === "won") {
      await supabase
        .from("purchases")
        .update({ status: "complete" })
        .eq("stripe_payment_intent_id", paymentIntentId)
        .eq("status", "disputed");
      return NextResponse.json({ received: true });
    }

    const { data: purchases } = await supabase
      .from("purchases")
      .select("id, artist_payout_cents, artist_net_payout_cents, stripe_transfer_id, tracks ( artists ( user_id ) )")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("status", "disputed");

    if (purchases && purchases.length > 0) {
      await supabase
        .from("purchases")
        .update({ status: "refunded" })
        .in("id", purchases.map((p) => p.id));
      await reverseArtistPayoutsAndVoidContributors(supabase, purchases as any);

      const artistUserId = (purchases[0] as any)?.tracks?.artists?.user_id ?? null;
      if (artistUserId) {
        await createNotification(supabase, {
          userId: artistUserId,
          type: "dispute",
          title: "A chargeback was lost",
          body: `$${(dispute.amount / 100).toFixed(2)} has been refunded to the buyer.`,
          link: "/dashboard/catalog",
        });
      }
    }

    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
