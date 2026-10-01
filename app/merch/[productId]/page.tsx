import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { MERCH_CATALOG, isMerchProductKey, variantPriceCents, variantsFor } from "@/lib/merchCatalog";
import { merchCheckoutEnabled, merchShippingCents, formatCents } from "@/lib/merch";
import { MerchPreview } from "../MerchArt";
import BuyMerchForm from "./BuyMerchForm";

export const dynamic = "force-dynamic";

async function loadProduct(productId: string) {
  if (!isUuid(productId)) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("merch_products")
    .select(
      "id, title, description, product_key, color, design_url, price_cents, active, artist_id, artists ( is_active, stripe_account_id, profiles ( display_name ) )"
    )
    .eq("id", productId)
    .maybeSingle();
  return data as any;
}

export async function generateMetadata({ params }: { params: { productId: string } }): Promise<Metadata> {
  const product = await loadProduct(params.productId);
  if (!product) return { title: "Merch · Fyby" };
  const artistName = product.artists?.profiles?.display_name ?? "a Fyby artist";
  return {
    title: `${product.title} by ${artistName} · Fyby Merch`,
    description: product.description ?? `Official merch from ${artistName}, printed on demand.`,
  };
}

export default async function MerchProductPage({ params }: { params: { productId: string } }) {
  const product = await loadProduct(params.productId);
  if (!product || !isMerchProductKey(product.product_key)) notFound();

  const item = MERCH_CATALOG[product.product_key as keyof typeof MERCH_CATALOG];
  const artistName = product.artists?.profiles?.display_name ?? "Fyby artist";
  const available =
    product.active && product.artists?.is_active !== false && Boolean(product.artists?.stripe_account_id);

  const variants = variantsFor(product.product_key, product.color).map((v) => ({
    id: v.id,
    size: v.size,
    priceCents: variantPriceCents(product.price_cents, product.product_key, product.color, v),
  }));

  return (
    <main className="max-w-5xl lg:max-w-6xl mx-auto px-6 lg:px-8 py-10">
      <Link href="/merch" className="font-mono text-xs text-paper/60 hover:text-gold">
        &larr; Merch Booth
      </Link>

      <div className="mt-6 grid md:grid-cols-2 gap-10 items-start">
        <div className="aspect-square rounded-3xl bg-[#100d16] border border-paper/10 flex items-center justify-center">
          <div className="w-4/5 h-4/5">
            <MerchPreview productKey={product.product_key} color={product.color} designUrl={product.design_url} />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <span className="font-mono text-xs tracking-widest uppercase text-flame">
              {item.label} · {product.color}
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight mt-1">{product.title}</h1>
            <Link href={`/artists/${product.artist_id}`} className="text-paper/70 hover:text-gold">
              by {artistName}
            </Link>
          </div>

          {product.description && <p className="text-paper/80 leading-relaxed whitespace-pre-line">{product.description}</p>}

          {available ? (
            merchCheckoutEnabled() ? (
              <BuyMerchForm productId={product.id} variants={variants} />
            ) : (
              <p className="font-mono text-sm text-flame">Checkout opens soon.</p>
            )
          ) : (
            <p className="font-mono text-sm text-rust">This item isn&apos;t available right now.</p>
          )}

          <ul className="font-mono text-xs text-paper/60 flex flex-col gap-1.5 border-t border-paper/10 pt-4">
            <li>Printed just for you, ships in about 5–10 business days</li>
            <li>US shipping {formatCents(merchShippingCents())}</li>
            <li>Every purchase pays {artistName} directly</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
