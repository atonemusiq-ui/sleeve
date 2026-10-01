import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createNotification } from "@/lib/notifications";
import { sendMerchShippedEmail } from "@/lib/email";

// Printful order updates for the Merch Booth. Set this URL as the webhook in
// Printful (Settings > API > Webhooks), with the secret as a query string:
//   https://getfyby.com/api/webhooks/printful?secret=<PRINTFUL_WEBHOOK_SECRET>
// Printful v1 webhooks aren't signed, so the shared secret in the URL is
// what stops anyone else from marking orders shipped.
//
// Orders are matched on external_id, which is our merch_orders.id without
// dashes (lib/printful.ts's externalIdFor).
export async function POST(req: Request) {
  const expected = process.env.PRINTFUL_WEBHOOK_SECRET;
  const given = new URL(req.url).searchParams.get("secret");
  if (!expected || given !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload: any = await req.json().catch(() => null);
  const type: string | undefined = payload?.type;
  const externalId: string | undefined = payload?.data?.order?.external_id;

  if (!type || !externalId || !/^[0-9a-f]{32}$/i.test(externalId)) {
    return NextResponse.json({ received: true });
  }

  // Back to the uuid form stored in merch_orders.id.
  const orderId = `${externalId.slice(0, 8)}-${externalId.slice(8, 12)}-${externalId.slice(12, 16)}-${externalId.slice(
    16,
    20
  )}-${externalId.slice(20)}`;

  const supabase = createServiceRoleClient();
  const { data: order } = await supabase
    .from("merch_orders")
    .select("id, status, buyer_email, product_title, artists ( user_id )")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ received: true });

  if (type === "package_shipped") {
    const shipment = payload?.data?.shipment ?? {};
    const trackingUrl: string | null = shipment.tracking_url ?? null;
    const carrier: string | null = shipment.carrier ?? null;

    if (order.status !== "shipped" && order.status !== "refunded") {
      await supabase
        .from("merch_orders")
        .update({ status: "shipped", tracking_url: trackingUrl, carrier, updated_at: new Date().toISOString() })
        .eq("id", order.id);

      if (order.buyer_email) {
        await sendMerchShippedEmail({
          to: order.buyer_email,
          productTitle: order.product_title,
          trackingUrl,
          carrier,
        });
      }
    }
  }

  if (type === "order_failed" || type === "order_canceled") {
    console.error(`Printful reported ${type} for merch order ${order.id} — needs manual review (refund the fan if it can't be fixed).`);
    if (order.status !== "refunded") {
      await supabase
        .from("merch_orders")
        .update({ status: "print_failed", updated_at: new Date().toISOString() })
        .eq("id", order.id);
    }
    const artistUserId = (order as any).artists?.user_id ?? null;
    if (artistUserId) {
      await createNotification(supabase, {
        userId: artistUserId,
        type: "merch",
        title: "A merch order needs attention",
        body: `Printful couldn't complete ${order.product_title}. Fyby will sort it out with the buyer.`,
        link: "/dashboard/merch",
      });
    }
  }

  return NextResponse.json({ received: true });
}
