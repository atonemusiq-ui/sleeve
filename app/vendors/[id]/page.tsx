import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { VENDOR_BUYER_NOTE, formatCents, vendorCategoryLabel } from "@/lib/vendors";
import VendorBuyForm from "./VendorBuyForm";

export const dynamic = "force-dynamic";

async function loadVendor(id: string) {
  if (!isUuid(id)) return null;
  const supabase = createClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, user_id, business_name, tagline, bio, city, logo_url, website_url, categories, plan_status, is_active, stripe_account_id")
    .eq("id", id)
    .maybeSingle();
  if (!vendor) return null;
  const { data: products } = await supabase
    .from("vendor_products")
    .select("id, title, description, kind, price_cents, shipping_cents, image_urls")
    .eq("vendor_id", id)
    .eq("active", true)
    .eq("frozen", false)
    .order("created_at", { ascending: false });
  return { vendor, products: products ?? [] };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await loadVendor(params.id);
  if (!data) return { title: "Fyby Vendors" };
  const title = `${data.vendor.business_name} · Fyby Vendors`;
  const description = data.vendor.tagline ?? "Shop this vendor on Fyby.";
  const image = data.products[0]?.image_urls?.[0] ?? data.vendor.logo_url ?? undefined;
  return { title, description, openGraph: { title, description, images: image ? [image] : undefined } };
}

// One vendor's page: who they are, their link, and their listings with
// photos and a Buy / Book button each.
export default async function VendorPage({ params }: { params: { id: string } }) {
  const data = await loadVendor(params.id);
  if (!data) notFound();
  const { vendor, products } = data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === vendor.user_id;
  const live = vendor.plan_status === "active" && vendor.is_active;
  const canSell = live && Boolean(vendor.stripe_account_id);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-8">
      {isOwner && !live && (
        <p className="font-mono text-xs text-rust border border-rust/40 rounded px-4 py-3">
          Only you can see this page until your Vendor Pro plan is active.{" "}
          <Link href="/vendor" className="underline">Open your Vendor portal</Link>
        </p>
      )}

      <section className="flex flex-wrap items-start gap-5">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-paper/10 border border-paper/15 flex-shrink-0 flex items-center justify-center">
          {vendor.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">🛍️</span>
          )}
        </div>
        <div className="flex-1 min-w-[14rem]">
          <Link href="/vendors" className="font-mono text-xs text-paper/50 hover:text-gold">
            &larr; Fyby Vendors
          </Link>
          <h1 className="font-display text-3xl text-gold mt-1">{vendor.business_name}</h1>
          {vendor.tagline && <p className="text-paper/70 mt-1">{vendor.tagline}</p>}
          <p className="font-mono text-xs text-paper/50 mt-2">{vendor.city}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(vendor.categories ?? []).map((c: string) => (
              <Link key={c} href={`/vendors?c=${c}`} className="font-mono text-[11px] px-2.5 py-1 rounded-full border border-paper/20 text-paper/70 hover:border-gold/50">
                {vendorCategoryLabel(c)}
              </Link>
            ))}
          </div>
          {vendor.website_url && (
            <a
              href={vendor.website_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-block mt-4 font-mono text-xs px-3 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10"
            >
              Visit website ↗
            </a>
          )}
          {isOwner && (
            <Link href="/vendor" className="inline-block mt-4 ml-2 font-mono text-xs px-3 py-2 rounded border border-paper/20 text-paper/70 hover:bg-paper/10">
              Edit in Vendor portal
            </Link>
          )}
        </div>
      </section>

      {vendor.bio && <p className="text-paper/80 whitespace-pre-line max-w-3xl">{vendor.bio}</p>}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl">Products &amp; services</h2>
        {products.length === 0 && <p className="font-mono text-sm text-paper/50">Nothing listed yet.</p>}
        <div className="grid sm:grid-cols-2 gap-5">
          {products.map((p: any) => (
            <article key={p.id} className="border border-paper/15 rounded-xl overflow-hidden bg-paper/5 flex flex-col">
              <div className="aspect-[4/3] bg-paper/10 flex overflow-x-auto snap-x snap-mandatory">
                {(p.image_urls ?? []).map((url: string) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" className="w-full h-full object-cover flex-shrink-0 snap-center" />
                ))}
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg">{p.title}</h3>
                  <span className="font-mono text-lg text-forest flex-shrink-0">{formatCents(p.price_cents)}</span>
                </div>
                <p className="font-mono text-[11px] text-paper/50">
                  {p.kind === "service"
                    ? "🗓️ Service · the vendor contacts you to schedule"
                    : `📦 Ships · ${p.shipping_cents > 0 ? `${formatCents(p.shipping_cents)} shipping` : "free shipping"}`}
                  {(p.image_urls ?? []).length > 1 && " · swipe for more photos"}
                </p>
                {p.description && <p className="text-paper/70 text-sm whitespace-pre-line">{p.description}</p>}
                <div className="mt-auto pt-2">
                  {isOwner ? (
                    <p className="font-mono text-xs text-gold">★ Your listing</p>
                  ) : canSell ? (
                    <VendorBuyForm productId={p.id} isService={p.kind === "service"} />
                  ) : (
                    <p className="font-mono text-xs text-paper/50">Not taking orders right now.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="font-mono text-[11px] text-paper/50">{VENDOR_BUYER_NOTE}</p>
      </section>
    </main>
  );
}
