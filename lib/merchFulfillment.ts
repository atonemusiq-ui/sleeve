import type Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripe } from "@/lib/stripe/server";
import { transferArtistPayout } from "@/lib/stripe/payouts";
import { createNotification } from "@/lib/notifications";
import { sendMerchOrderEmail } from "@/lib/email";
import { MERCH_CATALOG, isMerchProductKey } from "@/lib/merchCatalog";
import { cancelPrintfulOrder, createPrintfulOrder, externalIdFor } from "@/lib/printful";
import { isUuid } from "@/lib/uuid";
import { formatCents } from "@/lib/merch";

type Supabase = ReturnType<typeof createServiceRoleClient>;

export type MerchWebhookResult = { status: number; body: Record<string, unknown> };

const ok = (note?: string): MerchWebhookResult => ({ status: 200, body: { received: true, ...(note ? { note } : {}) } });

// Newer Stripe API versions moved the checkout's shipping address under
// collected_information; older ones had it at the top level. Read either.
function shippingFrom(session: Stripe.Checkout.Session): { name: string | null; address: Stripe.Address | null } {
  const s = session as any;
  const details = s.collected_information?.shipping_details ?? s.shipping_details ?? null;
  return { name: details?.name ?? session.customer_details?.name ?? null, address: details?.address ?? null };
}

// checkout.session.completed with metadata.type === "merch"
// (app/actions/merch.ts's startMerchCheckout). In order:
//   1. Record the order. stripe_session_id is unique, so a redelivered
//      event stops here instead of printing and paying twice.
//   2. Send it to Printful (or mark it test_mode when no Printful key is set).
//   3. Pay the artist their share, only once Printful has accepted the
//      order, so a sale that can't be printed never pays out.
export async function handleMerchCheckout(session: Stripe.Checkout.Session): Promise<MerchWebhookResult> {
  const m = session.metadata ?? {};
  const productId = m.product_id;
  const artistId = m.artist_id;
  const variantId = Number(m.variant_id);
  const quantity = Number(m.quantity);
  const unitPriceCents = Number(m.unit_price_cents);
  const unitCostCents = Number(m.unit_cost_cents);
  const shippingCents = Number(m.shipping_cents ?? 0);
  const platformFeeCents = Number(m.platform_fee_cents);
  const artistPayoutCents = Number(m.artist_payout_cents);
  const cardFeeCents = Number(m.card_fee_cents ?? 0);
  const artistCardShareCents = Number(m.artist_card_share_cents ?? 0);

  if (
    !isUuid(productId) ||
    !isUuid(artistId) ||
    ![variantId, quantity, unitPriceCents, unitCostCents, platformFeeCents, artistPayoutCents].every(Number.isFinite)
  ) {
    console.error("Merch webhook missing expected metadata:", m);
    return { status: 400, body: { error: "Missing metadata" } };
  }

  const supabase = createServiceRoleClient();
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const buyerEmail = session.customer_details?.email ?? null;
  const { name: shipName, address } = shippingFrom(session);

  const [{ data: product }, { data: artist }] = await Promise.all([
    supabase.from("merch_products").select("title, product_key, design_url").eq("id", productId).maybeSingle(),
    supabase
      .from("artists")
      .select("user_id, stripe_account_id, profiles ( display_name )")
      .eq("id", artistId)
      .maybeSingle(),
  ]);

  const productTitle = (product as any)?.title ?? "Fyby merch";

  const { data: order, error: insertError } = await supabase
    .from("merch_orders")
    .insert({
      product_id: productId,
      artist_id: artistId,
      fan_id: isUuid(m.fan_id) ? m.fan_id : null,
      buyer_email: buyerEmail,
      product_title: productTitle,
      variant_id: variantId,
      variant_label: m.variant_label ?? "",
      quantity,
      unit_price_cents: unitPriceCents,
      unit_cost_cents: unitCostCents,
      shipping_cents: shippingCents,
      amount_cents: unitPriceCents * quantity,
      platform_fee_cents: platformFeeCents,
      card_fee_cents: Number.isFinite(cardFeeCents) ? cardFeeCents : 0,
      artist_card_share_cents: Number.isFinite(artistCardShareCents) ? artistCardShareCents : 0,
      artist_payout_cents: artistPayoutCents,
      plan: m.plan ?? null,
      shipping_address: address ? { name: shipName, ...address } : null,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      status: "paid",
    })
    .select("id")
    .single();

  if (insertError) {
    if ((insertError as any).code === "23505") return ok("already processed");
    console.error("Failed to record merch order:", insertError.message);
    return { status: 500, body: { error: "Database error" } };
  }

  // --- 2. Printful -----------------------------------------------------------
  let status: "sent_to_printer" | "test_mode" | "print_failed" = "print_failed";
  let printfulOrderId: string | null = null;

  const productKey = (product as any)?.product_key;
  const designUrl = (product as any)?.design_url;

  if (!product || !isMerchProductKey(productKey) || !designUrl || !address?.line1 || !address.city || !address.postal_code) {
    console.error(`Merch order ${order.id}: missing product or shipping details — not sent to Printful.`);
  } else {
    const result = await createPrintfulOrder({
      externalId: externalIdFor(order.id),
      recipient: {
        name: shipName ?? "Fyby customer",
        address1: address.line1,
        address2: address.line2 ?? null,
        city: address.city,
        state_code: address.state ?? null,
        country_code: address.country ?? "US",
        zip: address.postal_code,
        email: buyerEmail,
        phone: session.customer_details?.phone ?? null,
      },
      variantId,
      quantity,
      fileType: MERCH_CATALOG[productKey].fileType,
      fileUrl: designUrl,
      retailPriceCents: unitPriceCents,
    });

    if (result.mode === "test") status = "test_mode";
    else if (result.mode === "live") {
      status = "sent_to_printer";
      printfulOrderId = result.orderId;
    } else {
      console.error(`Merch order ${order.id}: Printful rejected the order — ${result.message}. Artist not paid; needs manual review.`);
    }
  }

  // --- 3. Artist payout ------------------------------------------------------
  let transferId: string | null = null;
  const stripeAccountId = (artist as any)?.stripe_account_id ?? null;

  if (status !== "print_failed" && paymentIntentId && artistPayoutCents > 0) {
    if (!stripeAccountId) {
      console.error(`Merch order ${order.id}: artist ${artistId} has no connected Stripe account — not paid.`);
    } else {
      try {
        const transfer = await transferArtistPayout(paymentIntentId, artistPayoutCents, stripeAccountId, `merch_${order.id}`);
        transferId = transfer.id;
      } catch (err: any) {
        console.error(`Merch order ${order.id}: payout transfer failed —`, err.message);
      }
    }
  }

  await supabase
    .from("merch_orders")
    .update({ status, printful_order_id: printfulOrderId, stripe_transfer_id: transferId, updated_at: new Date().toISOString() })
    .eq("id", order.id);

  const artistUserId = (artist as any)?.user_id ?? null;
  if (artistUserId) {
    await createNotification(supabase, {
      userId: artistUserId,
      type: "sale",
      title: "You sold merch!",
      body:
        status === "print_failed"
          ? `${productTitle} sold, but the print order needs attention. Fyby is on it.`
          : `${productTitle} (${m.variant_label}) — ${formatCents(artistPayoutCents)} to you.`,
      link: "/dashboard/merch",
    });
  }

  if (buyerEmail) {
    await sendMerchOrderEmail({
      to: buyerEmail,
      productTitle,
      artistName: (artist as any)?.profiles?.display_name ?? "the artist",
      variantLabel: m.variant_label ?? "",
      quantity,
    });
  }

  return ok();
}

// Full refund or lost dispute: undo the artist payout and stop printing if
// Printful hasn't started. A partial refund is left for manual review, the
// same rule track sales follow.
export async function reverseMerchOrders(
  supabase: Supabase,
  paymentIntentId: string,
  opts: { refundedCents?: number; reason: "refund" | "dispute_lost" }
): Promise<void> {
  const { data: orders } = await supabase
    .from("merch_orders")
    .select("id, artist_id, amount_cents, shipping_cents, stripe_transfer_id, status, product_title, artists ( user_id )")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .neq("status", "refunded");

  for (const order of orders ?? []) {
    const total = (order.amount_cents ?? 0) + (order.shipping_cents ?? 0);
    if (opts.reason === "refund" && opts.refundedCents !== undefined && opts.refundedCents < total) {
      console.error(`Partial refund on merch order ${order.id} — needs manual review, nothing reversed.`);
      continue;
    }

    if (order.stripe_transfer_id) {
      try {
        await stripe.transfers.createReversal(order.stripe_transfer_id);
      } catch (err: any) {
        console.error(`Failed to reverse merch payout ${order.stripe_transfer_id}:`, err.message);
      }
    }

    if (order.status === "sent_to_printer") {
      await cancelPrintfulOrder(externalIdFor(order.id));
    }

    await supabase
      .from("merch_orders")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", order.id);

    const artistUserId = (order as any).artists?.user_id ?? null;
    if (artistUserId) {
      await createNotification(supabase, {
        userId: artistUserId,
        type: opts.reason === "refund" ? "refund" : "dispute",
        title: opts.reason === "refund" ? "A merch sale was refunded" : "A merch chargeback was lost",
        body: `${order.product_title} was refunded to the buyer.`,
        link: "/dashboard/merch",
      });
    }
  }
}

export async function setMerchDisputeStatus(supabase: Supabase, paymentIntentId: string, disputed: boolean): Promise<void> {
  if (disputed) {
    await supabase
      .from("merch_orders")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("stripe_payment_intent_id", paymentIntentId)
      .in("status", ["paid", "sent_to_printer", "test_mode", "shipped"]);
  } else {
    // Dispute won: the order stands. Put it back where it was: shipped if it
    // has tracking, test_mode if it never reached Printful, else at the printer.
    const { data: orders } = await supabase
      .from("merch_orders")
      .select("id, tracking_url, printful_order_id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("status", "disputed");

    for (const order of orders ?? []) {
      const status = order.tracking_url ? "shipped" : order.printful_order_id ? "sent_to_printer" : "test_mode";
      await supabase
        .from("merch_orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", order.id);
    }
  }
}
