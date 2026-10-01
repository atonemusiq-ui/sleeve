import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { planOf } from "@/lib/plans";
import { formatCents } from "@/lib/merch";
import MerchManager, { type ManagedProduct } from "./MerchManager";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  sent_to_printer: "At the printer",
  test_mode: "Test order",
  print_failed: "Needs attention",
  shipped: "Shipped",
  disputed: "Disputed",
  refunded: "Refunded",
};

// Artist dashboard > Merch: list products, see what each sale pays, and
// follow orders. Linked from app/dashboard/page.tsx.
export default async function DashboardMerchPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/merch");

  const { data: artist } = await supabase
    .from("artists")
    .select("id, plan, stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!artist) redirect("/");

  const plan = planOf((artist as any).plan);

  const [{ data: productRows }, { data: orderRows }] = await Promise.all([
    supabase
      .from("merch_products")
      .select("id, title, description, product_key, color, design_url, price_cents, active, created_at")
      .eq("artist_id", artist.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("merch_orders")
      .select("id, created_at, product_title, variant_label, quantity, status, artist_payout_cents, tracking_url")
      .eq("artist_id", artist.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const orders = orderRows ?? [];
  const paidOut = orders
    .filter((o) => o.status !== "refunded" && o.status !== "print_failed")
    .reduce((sum, o) => sum + (o.artist_payout_cents ?? 0), 0);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-8">
      <div>
        <Link href="/dashboard" className="font-mono text-xs text-paper/60 hover:text-gold">
          &larr; Dashboard
        </Link>
        <h1 className="font-display text-4xl mt-2">Merch</h1>
        <p className="text-paper/70 mt-2 max-w-2xl">
          Upload a design and Fyby&apos;s print partner makes each item when a fan orders it. No inventory, nothing
          to ship yourself.{" "}
          {plan === "pro"
            ? "You're on Pro: no merch fee, and your merch is featured in the Merch Booth."
            : "Fyby keeps 25% of your profit plus $0.20 per order. Upgrade to Pro for no merch fee and a spot in the Merch Booth."}
        </p>
      </div>

      {!(artist as any).stripe_account_id && (
        <p className="font-mono text-sm text-rust border border-rust/40 rounded-lg px-4 py-3">
          Connect your bank account under Payouts on the{" "}
          <Link href="/dashboard" className="underline">
            dashboard
          </Link>{" "}
          before listing merch, so you can get paid.
        </p>
      )}

      <MerchManager
        artistId={artist.id}
        plan={plan}
        canSell={Boolean((artist as any).stripe_account_id)}
        products={(productRows ?? []) as ManagedProduct[]}
      />

      <section aria-labelledby="orders-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 id="orders-heading" className="font-display text-2xl">
            Orders
          </h2>
          <span className="font-mono text-xs text-paper/60">
            Paid to you: <span className="text-forest">{formatCents(paidOut)}</span>
          </span>
        </div>
        {orders.length === 0 ? (
          <p className="font-mono text-xs text-paper/50">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto border border-paper/15 rounded-lg">
            <table className="w-full text-sm">
              <thead className="font-mono text-[11px] uppercase text-paper/50 text-left">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">You earn</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-paper/10">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-3 py-2">
                      {o.product_title}
                      <span className="block font-mono text-[11px] text-paper/50">{o.variant_label}</span>
                    </td>
                    <td className="px-3 py-2">{o.quantity}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {o.tracking_url ? (
                        <a href={o.tracking_url} className="text-gold underline" target="_blank" rel="noreferrer">
                          {STATUS_LABEL[o.status] ?? o.status}
                        </a>
                      ) : (
                        STATUS_LABEL[o.status] ?? o.status
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatCents(o.artist_payout_cents ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
