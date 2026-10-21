import type Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { transferArtistPayout } from "@/lib/stripe/payouts";
import { createNotification } from "@/lib/notifications";
import { sendVendorOrderEmail } from "@/lib/email";
import { formatCents } from "@/lib/vendors";
import { siteOrigin } from "@/lib/siteUrl";

// checkout.session.completed for a Fyby Vendors order (metadata.type
// "vendor_order", from app/actions/vendors.ts startVendorCheckout): record
// the order, pay the vendor (item price minus Fyby's cut, plus shipping)
// out of this exact charge, and tell the vendor about it. Safe to redeliver:
// stripe_session_id is unique, so a repeat delivery stops at the insert.
export async function handleVendorCheckout(
  session: Stripe.Checkout.Session
): Promise<{ status: number; body: Record<string, unknown> }> {
  const supabase = createServiceRoleClient();
  const m = session.metadata ?? {};
  const vendorId = m.vendor_id;
  if (!vendorId) return { status: 400, body: { error: "Missing vendor" } };

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, user_id, business_name, stripe_account_id")
    .eq("id", vendorId)
    .maybeSingle();
  if (!vendor) return { status: 400, body: { error: "Unknown vendor" } };

  const { data: product } = m.product_id
    ? await supabase.from("vendor_products").select("title, kind").eq("id", m.product_id).maybeSingle()
    : { data: null };

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const quantity = Number(m.quantity ?? 1);
  const payoutCents = Number(m.vendor_payout_cents ?? 0);
  const shippingDetails: any = (session as any).collected_information?.shipping_details ?? (session as any).shipping_details ?? null;

  const { data: order, error } = await supabase
    .from("vendor_orders")
    .insert({
      product_id: m.product_id ?? null,
      vendor_id: vendorId,
      buyer_id: m.buyer_id ?? null,
      buyer_email: session.customer_details?.email ?? null,
      buyer_phone: session.customer_details?.phone ?? null,
      product_title: product?.title ?? "Item",
      kind: product?.kind ?? "product",
      quantity,
      unit_price_cents: Number(m.unit_price_cents ?? 0),
      shipping_cents: Number(m.shipping_cents ?? 0),
      tax_cents: session.total_details?.amount_tax ?? 0,
      total_cents: session.amount_total ?? 0,
      platform_fee_cents: Number(m.platform_fee_cents ?? 0),
      vendor_payout_cents: payoutCents,
      shipping_address: shippingDetails
        ? { name: shippingDetails.name ?? session.customer_details?.name ?? null, ...shippingDetails.address }
        : null,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
    })
    .select("id")
    .single();

  if (error) {
    if ((error as any).code === "23505") return { status: 200, body: { received: true, note: "already processed" } };
    console.error("Failed to record vendor order:", error.message);
    return { status: 500, body: { error: "Database error" } };
  }

  if (vendor.stripe_account_id && paymentIntentId && payoutCents > 0) {
    try {
      const transfer = await transferArtistPayout(paymentIntentId, payoutCents, vendor.stripe_account_id, `vendor_order_${order.id}`);
      await supabase.from("vendor_orders").update({ stripe_transfer_id: transfer.id }).eq("id", order.id);
    } catch (err: any) {
      // The order stands; the payout is reconciled by hand in Stripe.
      console.error(`Failed to pay vendor ${vendorId} for order ${order.id}:`, err.message);
    }
  }

  const title = product?.title ?? "an item";
  const isService = product?.kind === "service";
  await createNotification(supabase, {
    userId: vendor.user_id,
    type: "vendor_order",
    title: `New ${isService ? "booking" : "order"}: ${title}`,
    body: `${quantity > 1 ? `${quantity} × ` : ""}${title}. You earn ${formatCents(payoutCents)}.${
      isService ? " Contact the customer to schedule." : " Ship it to the address in your Vendor portal."
    }`,
    link: "/vendor#orders",
  });

  const { data: owner } = await supabase.auth.admin.getUserById(vendor.user_id);
  if (owner?.user?.email) {
    await sendVendorOrderEmail({
      to: owner.user.email,
      productTitle: title,
      quantity,
      payoutCents,
      isService,
      buyerEmail: session.customer_details?.email ?? null,
      portalUrl: `${siteOrigin()}/vendor#orders`,
    });
  }

  return { status: 200, body: { received: true } };
}
