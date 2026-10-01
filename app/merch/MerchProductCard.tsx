import Link from "next/link";
import { MerchPreview } from "./MerchArt";
import { MERCH_CATALOG, isMerchProductKey } from "@/lib/merchCatalog";
import { fanUnitPriceCents, formatCents } from "@/lib/merch";

export type MerchCardProduct = {
  id: string;
  title: string;
  product_key: string;
  color: string;
  design_url: string;
  price_cents: number;
  artistName?: string | null;
};

// One product tile, used on the Merch Booth and on artist pages.
export default function MerchProductCard({ product }: { product: MerchCardProduct }) {
  if (!isMerchProductKey(product.product_key)) return null;
  const item = MERCH_CATALOG[product.product_key];

  return (
    <li className="rounded-2xl bg-ink/70 border border-paper/10 p-3 flex flex-col gap-3">
      <Link href={`/merch/${product.id}`} className="flex flex-col gap-3 group">
        <div className="aspect-square rounded-xl bg-[#100d16] flex items-center justify-center">
          <div className="w-4/5 h-4/5">
            <MerchPreview productKey={product.product_key} color={product.color} designUrl={product.design_url} />
          </div>
        </div>
        <div className="px-1 flex flex-col gap-0.5">
          <span className="font-mono text-[11px] tracking-wider uppercase text-flame">{item.label}</span>
          <h3 className="font-semibold text-lg leading-tight group-hover:text-gold">{product.title}</h3>
          {product.artistName && <span className="text-paper/60 text-sm">{product.artistName}</span>}
        </div>
      </Link>
      <div className="mt-auto px-1 pb-1 flex items-center justify-between">
        <span className="font-semibold">{formatCents(fanUnitPriceCents(product.price_cents, product.product_key))}</span>
        <Link
          href={`/merch/${product.id}`}
          className="font-mono text-xs px-3 py-2 rounded-full bg-flame text-ink font-medium hover:bg-gold"
        >
          Buy
        </Link>
      </div>
    </li>
  );
}
