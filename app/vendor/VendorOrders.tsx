"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markVendorOrderFulfilled } from "@/app/actions/vendors";
import { formatCents } from "@/lib/vendors";

type Order = {
  id: string;
  product_title: string;
  kind: string;
  quantity: number;
  total_cents: number;
  vendor_payout_cents: number;
  buyer_email: string | null;
  buyer_phone: string | null;
  shipping_address: Record<string, string | null> | null;
  status: "paid" | "fulfilled" | "refunded";
  created_at: string;
};

export default function VendorOrders({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="font-mono text-sm text-paper/50">No orders yet. You&apos;ll get a notification and an email when someone buys.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <OrderRow key={o.id} order={o} />
      ))}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const a = order.shipping_address;
  const address = a
    ? [a.name, a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(", ")].filter(Boolean).join("\n")
    : null;

  return (
    <div className={`border rounded-lg px-5 py-4 flex flex-col gap-2 ${order.status === "paid" ? "border-gold/40 bg-gold/5" : "border-paper/15 bg-paper/5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="font-display text-base">
            {order.quantity > 1 ? `${order.quantity} × ` : ""}
            {order.product_title}
          </span>
          <p className="font-mono text-[11px] text-paper/50">
            {new Date(order.created_at).toLocaleString()} · {order.kind === "service" ? "Booking" : "Order"} · customer paid{" "}
            {formatCents(order.total_cents)}
          </p>
        </div>
        <span className="font-mono text-sm text-forest">You earn {formatCents(order.vendor_payout_cents)}</span>
      </div>
      <div className="font-mono text-xs text-paper/70 whitespace-pre-line">
        {order.buyer_email && <div>✉️ {order.buyer_email}</div>}
        {order.buyer_phone && <div>📞 {order.buyer_phone}</div>}
        {address && <div className="mt-1">📦 Ship to:{"\n"}{address}</div>}
      </div>
      <div className="flex items-center gap-3">
        {order.status === "paid" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const f = new FormData();
                f.set("orderId", order.id);
                await markVendorOrderFulfilled(f);
                router.refresh();
              })
            }
            className="font-mono text-xs px-3 py-1.5 rounded border border-forest/40 text-forest hover:bg-forest/10 disabled:opacity-50"
          >
            {order.kind === "service" ? "Mark completed" : "Mark shipped"}
          </button>
        ) : (
          <span className={`font-mono text-xs ${order.status === "refunded" ? "text-rust" : "text-forest"}`}>
            {order.status === "refunded" ? "Refunded" : "✓ Fulfilled"}
          </span>
        )}
      </div>
    </div>
  );
}
