"use client";

import { useState } from "react";
import { startMerchCheckout } from "@/app/actions/merch";

type Variant = { id: number; size: string; priceCents: number };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-flame text-ink font-semibold text-lg hover:bg-gold transition-colors disabled:opacity-60"
    >
      {pending ? "Opening checkout…" : label}
    </button>
  );
}

// Size + quantity picker and the Buy button. Posts to the startMerchCheckout
// server action, which redirects to Stripe Checkout (shipping address and
// card are collected there).
export default function BuyMerchForm({ productId, variants }: { productId: string; variants: Variant[] }) {
  const [variantId, setVariantId] = useState<number>(variants[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  if (!variant) return null;

  return (
    <form action={startMerchCheckout} onSubmit={() => setPending(true)} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variant.id} />

      <p className="font-display text-3xl text-forest">{money(variant.priceCents * quantity)}</p>

      {variants.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-mono text-xs text-paper/60 mb-2">Size</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <label
                key={v.id}
                className={`cursor-pointer min-w-[3rem] min-h-[44px] px-4 rounded-full border flex items-center justify-center font-mono text-sm ${
                  v.id === variant.id ? "bg-paper text-ink border-paper" : "border-paper/25 text-paper hover:border-gold/60"
                }`}
              >
                <input
                  type="radio"
                  name="size"
                  value={v.id}
                  checked={v.id === variant.id}
                  onChange={() => setVariantId(v.id)}
                  className="sr-only"
                />
                {v.size}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex items-center gap-3 font-mono text-xs text-paper/60">
        Quantity
        <select
          name="quantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="bg-ink border border-paper/25 rounded-lg px-3 py-2 text-paper text-sm"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <SubmitButton pending={pending} label={`Buy · ${money(variant.priceCents * quantity)}`} />
      <p className="font-mono text-[11px] text-paper/50">Shipping and any tax are added at checkout.</p>
    </form>
  );
}
