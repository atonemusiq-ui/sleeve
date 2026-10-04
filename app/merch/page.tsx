import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MerchArt, MerchPreview } from "./MerchArt";
import MerchProductCard, { type MerchCardProduct } from "./MerchProductCard";
import { MERCH_CATALOG, type MerchProductKey } from "@/lib/merchCatalog";
import { fanUnitPriceCents, formatCents } from "@/lib/merch";
import SponsoredCard from "../SponsoredCard";

// getfyby.com/merch: the Merch Booth (Phase 10). Shows merch from Pro-plan
// artists, which is one of the Pro perks; artists on other plans sell from
// their own artist page only (app/artists/[id]/page.tsx). Print-on-demand
// through Printful; checkout lives on each product page (app/merch/[productId]).
export const metadata: Metadata = {
  title: "Merch Booth · Fyby",
  description: "Artist merch, printed when you order and shipped to your door.",
};

export const dynamic = "force-dynamic";

// The five merch items fans buy most, in order. Shown as "coming soon" tiles
// until Pro artists have listed products.
const TOP_FIVE: { rank: string; key: MerchProductKey; detail: string }[] = [
  { rank: "#1 Best seller", key: "tee", detail: "Soft, everyday fit" },
  { rank: "#2 Top earner", key: "hoodie", detail: "Heavyweight blend" },
  { rank: "#3", key: "hat", detail: "Classic dad hat" },
  { rank: "#4", key: "tote", detail: "Everyday carry" },
  { rank: "#5", key: "mug", detail: "11 or 15 oz" },
];

export default async function MerchPage() {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("merch_products")
    .select("id, title, product_key, color, design_url, price_cents, created_at, artists!inner ( plan, is_active, profiles ( display_name ) )")
    .eq("active", true)
    .eq("artists.plan", "pro")
    .eq("artists.is_active", true)
    .order("created_at", { ascending: false })
    .limit(60);

  const products: MerchCardProduct[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    product_key: r.product_key,
    color: r.color,
    design_url: r.design_url,
    price_cents: r.price_cents,
    artistName: r.artists?.profiles?.display_name ?? null,
  }));

  const drop = products[0] ?? null;

  return (
    <main className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-12">
      {/* Drop of the Week: the newest Pro listing */}
      <section
        aria-labelledby="drop-heading"
        className="grid md:grid-cols-2 gap-8 items-center rounded-3xl bg-ink/70 border border-paper/10 p-6 sm:p-10"
      >
        <div className="flex flex-col gap-4">
          <span className="self-start font-mono text-xs tracking-widest uppercase px-3 py-1 rounded-full bg-flame text-ink font-medium">
            {drop ? "Drop of the week" : "The Fyby Merch Booth"}
          </span>
          <h1 id="drop-heading" className="font-display text-4xl sm:text-5xl font-bold leading-tight">
            {drop ? drop.title : "The Fyby Merch Booth"}
          </h1>
          <p className="text-paper/70 text-lg leading-relaxed max-w-md">
            {drop?.artistName ? `By ${drop.artistName}. ` : ""}
            Printed when you order and shipped to your door. Every purchase pays the artist directly.
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            {drop ? (
              <Link
                href={`/merch/${drop.id}`}
                className="inline-flex items-center px-6 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold transition-colors"
              >
                Shop the drop · {formatCents(fanUnitPriceCents(drop.price_cents, drop.product_key as MerchProductKey))}
              </Link>
            ) : (
              <span className="inline-flex items-center px-5 py-3 rounded-full border border-flame/60 text-flame font-medium">
                First drops coming soon
              </span>
            )}
          </div>
        </div>
        <div className="aspect-square rounded-2xl bg-[#100d16] flex items-center justify-center">
          <div className="w-3/4 h-3/4">
            {drop ? (
              <MerchPreview productKey={drop.product_key as MerchProductKey} color={drop.color} designUrl={drop.design_url} />
            ) : (
              <MerchArt productKey="tee" />
            )}
          </div>
        </div>
      </section>

      {products.length > 0 ? (
        <section aria-labelledby="shop-heading" className="flex flex-col gap-6">
          <div>
            <h2 id="shop-heading" className="font-display text-3xl font-bold">
              Shop the Booth
            </h2>
            <p className="text-paper/70 mt-1">Every piece printed on demand.</p>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <MerchProductCard key={p.id} product={p} />
            ))}
          </ul>
        </section>
      ) : (
        <section aria-labelledby="top-heading" className="flex flex-col gap-6">
          <div>
            <h2 id="top-heading" className="font-display text-3xl font-bold">
              Shop the top 5
            </h2>
            <p className="text-paper/70 mt-1">What fans buy most. Every piece printed on demand.</p>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {TOP_FIVE.map((p) => (
              <li key={p.key} className="rounded-2xl bg-ink/70 border border-paper/10 p-3 flex flex-col gap-3">
                <div className="aspect-square rounded-xl bg-[#100d16] flex items-center justify-center">
                  <div className="w-4/5 h-4/5">
                    <MerchArt productKey={p.key} />
                  </div>
                </div>
                <div className="px-1 flex flex-col gap-1">
                  <span className="font-mono text-[11px] tracking-wider uppercase text-flame">{p.rank}</span>
                  <h3 className="font-semibold text-lg leading-tight">{MERCH_CATALOG[p.key].label}</h3>
                  <span className="text-paper/60 text-sm">{p.detail}</span>
                </div>
                <span className="mt-auto mx-1 mb-1 font-mono text-xs text-paper/50">Coming soon</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SponsoredCard placement="merch" />

      {/* Fyby Radio tie-in */}
      <section
        aria-labelledby="radio-heading"
        className="flex flex-wrap items-center gap-5 rounded-2xl border border-paper/15 p-5 sm:p-6"
      >
        <div className="h-14 w-14 rounded-full bg-flame flex items-center justify-center shrink-0" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="#16121A" strokeWidth="2" strokeLinecap="round" className="h-7 w-7">
            <circle cx="12" cy="12" r="2" />
            <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" />
          </svg>
        </div>
        <div className="flex-1 min-w-[12rem]">
          <span className="font-mono text-xs tracking-widest uppercase text-flame">Hear it, then wear it</span>
          <h2 id="radio-heading" className="font-semibold text-xl">
            Shop the artist playing on Fyby Radio
          </h2>
        </div>
        <Link
          href="/radio"
          className="px-5 py-3 rounded-full bg-paper text-ink font-semibold hover:bg-gold transition-colors"
        >
          Open Fyby Radio
        </Link>
      </section>

      {/* For artists */}
      <section
        aria-labelledby="artists-heading"
        className="grid md:grid-cols-2 gap-6 items-center rounded-3xl bg-ink/70 border border-paper/10 p-6 sm:p-9"
      >
        <div className="flex flex-col gap-2">
          <h2 id="artists-heading" className="font-display text-2xl sm:text-3xl font-bold">
            Artists: sell merch without carrying a box of shirts
          </h2>
          <p className="text-paper/70 leading-relaxed">
            Upload a design, see your profit before you publish, and let fans order. Pro artists are
            featured here in the Booth; every artist can sell from their own page. Soon you&apos;ll
            also be able to make a 15-second commercial that plays on Fyby TV.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <span className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-flame/60 text-flame font-medium">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <path d="M3 9h18v11H3z" />
              <path d="m3 9 2-5h16l-2 5" />
              <path d="m8 4 2 5M13 4l2 5" />
            </svg>
            Make a Commercial · soon
          </span>
          <Link
            href="/dashboard/merch"
            className="px-5 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold transition-colors"
          >
            Sell merch
          </Link>
        </div>
      </section>
    </main>
  );
}
