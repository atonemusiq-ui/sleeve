import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import CollapsibleSection from "@/app/CollapsibleSection";
import { VENDOR_PLAN, formatPlanPrice } from "@/lib/plans";
import { VENDOR_BUYER_NOTE, VENDOR_RATE_PERCENT, formatCents } from "@/lib/vendors";
import { startVendorPlanCheckout } from "@/app/actions/vendors";
import { connectVendorStripeAccount } from "@/app/actions/stripe-connect";
import VendorProfileForm from "./VendorProfileForm";
import VendorProductManager from "./VendorProductManager";
import VendorOrders from "./VendorOrders";
import CancelVendorPlanButton from "./CancelVendorPlanButton";

export const dynamic = "force-dynamic";

// The Vendor portal (Fyby Vendors, lib/vendors.ts): the merchant's version
// of the artist dashboard. Same layout and sign-in, no music upload: a
// profile with what they do and their website link, product/service
// listings with photos, the required Vendor Pro plan, payouts and orders.
export default async function VendorPortalPage({ searchParams }: { searchParams?: { plan?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/vendor")}`);

  const admin = createServiceRoleClient();
  let { data: vendor } = await admin
    .from("vendors")
    .select("id, business_name, tagline, bio, logo_url, website_url, city, categories, stripe_account_id, plan_status, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vendor) {
    const { data: profile } = await admin.from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();
    if (profile?.role !== "vendor") {
      return (
        <main className="max-w-xl mx-auto px-6 py-24 text-center">
          <h1 className="font-display text-3xl text-gold mb-4">Vendor portal</h1>
          <p className="text-paper/70 mb-8">
            This account isn&apos;t a vendor account. To sell products or services on Fyby, create a vendor account
            with a different email.
          </p>
          <Link href="/vendors" className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10">
            Browse Fyby Vendors
          </Link>
        </main>
      );
    }
    // A vendor account created before the vendors row existed: make it now.
    const { data: created } = await admin
      .from("vendors")
      .insert({ user_id: user.id, business_name: profile.display_name ?? "" })
      .select("id, business_name, tagline, bio, logo_url, website_url, city, categories, stripe_account_id, plan_status, is_active")
      .single();
    vendor = created;
  }
  if (!vendor) redirect("/");

  const [{ data: products }, { data: orders }] = await Promise.all([
    admin
      .from("vendor_products")
      .select("id, title, description, kind, price_cents, shipping_cents, image_urls, active, frozen, created_at")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false }),
    admin
      .from("vendor_orders")
      .select(
        "id, product_title, kind, quantity, total_cents, vendor_payout_cents, buyer_email, buyer_phone, shipping_address, status, created_at"
      )
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const live = vendor.plan_status === "active" && vendor.is_active;
  const earnedCents = (orders ?? []).filter((o) => o.status !== "refunded").reduce((sum, o) => sum + (o.vendor_payout_cents ?? 0), 0);
  const openOrders = (orders ?? []).filter((o) => o.status === "paid").length;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-flame">Vendor portal</p>
          <h1 className="font-display text-3xl text-gold mt-1">{vendor.business_name || "Your business"}</h1>
          <p className="font-mono text-xs text-paper/60 mt-1">
            {live ? "● Live on Fyby Vendors" : "○ Not live yet — finish the steps below"}
          </p>
        </div>
        <div className="flex gap-3 font-mono text-xs">
          {live && (
            <Link href={`/vendors/${vendor.id}`} className="px-3 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10">
              View my page
            </Link>
          )}
          <Link href="/vendors" className="px-3 py-2 rounded border border-paper/20 text-paper/70 hover:bg-paper/10">
            🛍️ All vendors
          </Link>
        </div>
      </header>

      {searchParams?.plan === "success" && (
        <p role="status" className="font-mono text-sm text-forest border border-forest/40 bg-forest/10 rounded px-4 py-3 mb-8">
          ✓ Welcome to {VENDOR_PLAN.label}! Your plan is being activated — refresh in a few seconds if it still says
          not live.
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-10">
        <Stat label="Listings" value={String((products ?? []).length)} />
        <Stat label="Orders to fulfill" value={String(openOrders)} />
        <Stat label="Earned" value={formatCents(earnedCents)} />
      </div>

      {/* Step 1: plan */}
      <section className="border border-flame/40 rounded-lg px-6 py-5 mb-6 bg-flame/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg text-flame">
              1. {VENDOR_PLAN.label} — {formatPlanPrice(VENDOR_PLAN.priceCents)}/month
            </h2>
            <p className="font-mono text-xs text-paper/70 mt-1 max-w-2xl">
              Required to sell and to be listed on the Vendors page and the Fyby advertising page. Fyby takes{" "}
              {VENDOR_RATE_PERCENT}% of each sale (Amazon charges $39.99/month plus up to 15%). No listing, storage or
              fulfillment fees. {VENDOR_BUYER_NOTE}
            </p>
          </div>
          {vendor.plan_status === "active" ? (
            <div className="flex flex-col items-end gap-2">
              <span className="font-mono text-xs text-forest">✓ Active</span>
              <CancelVendorPlanButton />
            </div>
          ) : (
            <form action={startVendorPlanCheckout}>
              <button className="font-mono text-sm px-4 py-2.5 rounded bg-flame text-ink font-semibold hover:opacity-90">
                {vendor.plan_status === "past_due" ? "Update payment" : "Start Vendor Pro"}
              </button>
            </form>
          )}
        </div>
        {vendor.plan_status === "past_due" && (
          <p className="font-mono text-xs text-rust mt-3">Your last payment didn&apos;t go through. Update it to stay live.</p>
        )}
      </section>

      {/* Step 2: payouts */}
      <section className="border border-paper/15 rounded-lg px-6 py-5 mb-6 bg-paper/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg">2. Get paid</h2>
            <p className="font-mono text-xs text-paper/60 mt-1 max-w-2xl">
              Connect Stripe so your earnings land in your bank (or a debit card, including Cash App or Chime cards).
              You get the sale price minus {VENDOR_RATE_PERCENT}%, plus the shipping the customer paid.
            </p>
          </div>
          <form action={connectVendorStripeAccount}>
            <button className="font-mono text-xs px-3 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10">
              {vendor.stripe_account_id ? "Update payout details" : "Connect Stripe"}
            </button>
          </form>
        </div>
        <p className={`font-mono text-xs mt-2 ${vendor.stripe_account_id ? "text-forest" : "text-paper/50"}`}>
          {vendor.stripe_account_id ? "✓ Connected" : "Not connected"}
        </p>
      </section>

      <CollapsibleSection
        id="profile"
        title="3. Your business profile"
        description="What you do, where you are, and your website link. Your link also appears on the Fyby advertising page."
        defaultOpen={!vendor.categories?.length}
      >
        <VendorProfileForm vendor={vendor as any} />
      </CollapsibleSection>

      <CollapsibleSection
        id="products"
        title="4. Products & services"
        description="Add photos and a price. Products ship (you set the shipping price); services are booked and you contact the customer."
        defaultOpen
      >
        <VendorProductManager vendorId={vendor.id} products={(products ?? []) as any} />
      </CollapsibleSection>

      <CollapsibleSection id="orders" title={`Orders${openOrders ? ` (${openOrders} to fulfill)` : ""}`} defaultOpen={openOrders > 0}>
        <VendorOrders orders={(orders ?? []) as any} />
      </CollapsibleSection>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-paper/15 rounded-lg px-4 py-3 bg-paper/5">
      <p className="font-mono text-[11px] uppercase tracking-wider text-paper/50">{label}</p>
      <p className="font-display text-2xl text-paper mt-1">{value}</p>
    </div>
  );
}
