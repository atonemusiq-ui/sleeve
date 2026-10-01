"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createMerchProduct, setMerchProductActive, updateMerchPrice } from "@/app/actions/merch";
import { MERCH_CATALOG, MERCH_PRODUCT_KEYS, baseCostCents, type MerchProductKey } from "@/lib/merchCatalog";
import { merchSplit, minimumPriceCents, formatCents } from "@/lib/merch";
import type { Plan } from "@/lib/plans";
import { MerchPreview } from "@/app/merch/MerchArt";

export type ManagedProduct = {
  id: string;
  title: string;
  description: string | null;
  product_key: string;
  color: string;
  design_url: string;
  price_cents: number;
  active: boolean;
};

const MAX_DESIGN_BYTES = 50 * 1024 * 1024;

// Per-item breakdown for a one-item order at the artist's price: what the
// fan sees, printing, Fyby's fee, the artist's half of the card fee, and what
// the artist keeps. Same math the webhook pays out (lib/merch.ts).
function Breakdown({
  priceCents,
  costCents,
  plan,
  productKey,
}: {
  priceCents: number;
  costCents: number;
  plan: Plan;
  productKey: MerchProductKey;
}) {
  const split = merchSplit(priceCents, costCents, 1, plan, productKey);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
      <dt className="text-paper/60">Fans see</dt>
      <dd className="text-right">{formatCents(split.fanUnitPriceCents)}</dd>
      <dt className="text-paper/60">Your price</dt>
      <dd className="text-right">{formatCents(priceCents)}</dd>
      <dt className="text-paper/60">Printing</dt>
      <dd className="text-right">−{formatCents(costCents)}</dd>
      <dt className="text-paper/60">Fyby fee</dt>
      <dd className="text-right">−{formatCents(split.platformFeeCents)}</dd>
      <dt className="text-paper/60">Your half of card fee</dt>
      <dd className="text-right">−{formatCents(split.artistCardShareCents)}</dd>
      <dt className="text-paper">You earn</dt>
      <dd className="text-right text-forest font-semibold">{formatCents(split.artistPayoutCents)}</dd>
    </dl>
  );
}

export default function MerchManager({
  artistId,
  plan,
  canSell,
  products,
}: {
  artistId: string;
  plan: Plan;
  canSell: boolean;
  products: ManagedProduct[];
}) {
  const router = useRouter();
  const [productKey, setProductKey] = useState<MerchProductKey>("tee");
  const colors = Object.keys(MERCH_CATALOG[productKey].colors);
  const [color, setColor] = useState<string>(colors[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("30");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeColor = colors.includes(color) ? color : colors[0];
  const costCents = baseCostCents(productKey, activeColor);
  const priceCents = Math.round((Number(price) || 0) * 100);
  const minimum = minimumPriceCents(costCents);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!file) return setError("Choose your design file.");
    if (file.size > MAX_DESIGN_BYTES) return setError("Design file is too big (max 50 MB).");
    if (priceCents < minimum) return setError(`The lowest price for this item is ${formatCents(minimum)}.`);

    setBusy(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `${artistId}/design-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("merch-designs").upload(path, file);
      if (uploadError) throw new Error(`Design upload failed: ${uploadError.message}`);
      const designUrl = supabase.storage.from("merch-designs").getPublicUrl(path).data.publicUrl;

      const formData = new FormData();
      formData.set("productKey", productKey);
      formData.set("color", activeColor);
      formData.set("title", title);
      formData.set("description", description);
      formData.set("designUrl", designUrl);
      formData.set("price", price);

      const result = await createMerchProduct(formData);
      if (result.error) throw new Error(result.error);

      setTitle("");
      setDescription("");
      setFile(null);
      setNotice("Your merch is live.");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(product: ManagedProduct) {
    const formData = new FormData();
    formData.set("productId", product.id);
    formData.set("active", String(!product.active));
    const result = await setMerchProductActive(formData);
    if (result.error) setError(result.error);
    router.refresh();
  }

  async function savePrice(productId: string, newPrice: string) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("price", newPrice);
    const result = await updateMerchPrice(formData);
    if (result.error) setError(result.error);
    else setNotice("Price updated.");
    router.refresh();
  }

  const inputClass = "w-full bg-ink border border-paper/25 rounded-lg px-3 py-2.5 text-paper";

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="font-mono text-sm text-rust">{error}</p>}
      {notice && <p className="font-mono text-sm text-forest">{notice}</p>}

      <section aria-labelledby="new-merch-heading" className="border border-paper/15 rounded-lg p-5 sm:p-6">
        <h2 id="new-merch-heading" className="font-display text-2xl mb-4">
          Add merch
        </h2>
        <form onSubmit={handleCreate} className="grid md:grid-cols-[1fr_260px] gap-6">
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="font-mono text-xs text-paper/60 mb-2">Product</legend>
              <div className="flex flex-wrap gap-2">
                {MERCH_PRODUCT_KEYS.map((key) => (
                  <label
                    key={key}
                    className={`cursor-pointer min-h-[44px] px-4 rounded-full border flex items-center font-mono text-sm ${
                      key === productKey ? "bg-paper text-ink border-paper" : "border-paper/25 hover:border-gold/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="productKey"
                      value={key}
                      checked={key === productKey}
                      onChange={() => {
                        setProductKey(key);
                        setColor(Object.keys(MERCH_CATALOG[key].colors)[0]);
                      }}
                      className="sr-only"
                    />
                    {MERCH_CATALOG[key].label}
                  </label>
                ))}
              </div>
            </fieldset>

            {colors.length > 1 && (
              <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
                Color
                <select value={activeColor} onChange={(e) => setColor(e.target.value)} className={inputClass}>
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
              Name
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder="Tour Tee" className={inputClass} />
            </label>

            <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
              Description (optional)
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className={inputClass} />
            </label>

            <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
              Design file
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-paper text-xs file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:bg-gold file:text-ink file:font-mono file:cursor-pointer"
              />
              <span className="text-paper/45">{MERCH_CATALOG[productKey].designTip}</span>
            </label>

            <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60 max-w-[12rem]">
              Your price (USD)
              <input
                type="number"
                min={minimum / 100}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
              />
              <span className="text-paper/45">Lowest: {formatCents(minimum)}</span>
            </label>
          </div>

          <div className="flex flex-col gap-4">
            <div className="aspect-square rounded-xl bg-[#100d16] flex items-center justify-center">
              <div className="w-4/5 h-4/5">
                <MerchPreview productKey={productKey} color={activeColor} designUrl={previewUrl} />
              </div>
            </div>
            <Breakdown priceCents={priceCents} costCents={costCents} plan={plan} productKey={productKey} />
            <p className="font-mono text-[11px] text-paper/45">
              Fans pay shipping at checkout. The card fee is split: half is built into the price fans see, half
              comes from your earnings. Bigger sizes cost the fan a little more, so you earn about the same on every size.
            </p>
            <button
              type="submit"
              disabled={busy || !canSell}
              className="px-5 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold disabled:opacity-50"
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="your-merch-heading" className="flex flex-col gap-3">
        <h2 id="your-merch-heading" className="font-display text-2xl">
          Your merch
        </h2>
        {products.length === 0 ? (
          <p className="font-mono text-xs text-paper/50">Nothing listed yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {products.map((p) => (
              <ProductRow key={p.id} product={p} plan={plan} onToggle={() => toggleActive(p)} onSavePrice={savePrice} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProductRow({
  product,
  plan,
  onToggle,
  onSavePrice,
}: {
  product: ManagedProduct;
  plan: Plan;
  onToggle: () => void;
  onSavePrice: (productId: string, price: string) => void;
}) {
  const [price, setPrice] = useState((product.price_cents / 100).toFixed(2));
  const key = product.product_key as MerchProductKey;
  const known = Boolean(MERCH_CATALOG[key]);
  const costCents = known ? baseCostCents(key, product.color) : 0;
  const split = known ? merchSplit(product.price_cents, costCents, 1, plan, key) : null;

  return (
    <li className="flex flex-wrap items-center gap-4 border border-paper/15 rounded-lg p-3">
      <div className="h-20 w-20 rounded-lg bg-[#100d16] flex items-center justify-center shrink-0">
        <div className="w-4/5 h-4/5">{known && <MerchPreview productKey={key} color={product.color} designUrl={product.design_url} />}</div>
      </div>
      <div className="flex-1 min-w-[10rem]">
        <Link href={`/merch/${product.id}`} className="font-semibold hover:text-gold">
          {product.title}
        </Link>
        <p className="font-mono text-[11px] text-paper/50">
          {known ? MERCH_CATALOG[key].label : product.product_key} · {product.color} · fans see {split ? formatCents(split.fanUnitPriceCents) : "—"} · you earn{" "}
          {split ? formatCents(split.artistPayoutCents) : "—"} each
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSavePrice(product.id, price);
        }}
        className="flex items-center gap-2"
      >
        <label className="sr-only" htmlFor={`price-${product.id}`}>
          Price
        </label>
        <input
          id={`price-${product.id}`}
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-24 bg-ink border border-paper/25 rounded-lg px-2 py-2 text-sm"
        />
        <button type="submit" className="font-mono text-xs px-3 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10">
          Save
        </button>
      </form>
      <button
        type="button"
        onClick={onToggle}
        className={`font-mono text-xs px-3 py-2 rounded-full border ${
          product.active ? "text-forest border-forest/40" : "text-paper/60 border-paper/25"
        }`}
      >
        {product.active ? "On sale · hide" : "Hidden · put on sale"}
      </button>
    </li>
  );
}
