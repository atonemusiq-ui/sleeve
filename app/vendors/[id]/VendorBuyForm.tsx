"use client";

import { useState } from "react";
import { startVendorCheckout } from "@/app/actions/vendors";
import { MAX_VENDOR_QUANTITY } from "@/lib/vendors";

export default function VendorBuyForm({ productId, isService }: { productId: string; isService: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <form action={startVendorCheckout} onSubmit={() => setBusy(true)} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      {!isService && (
        <select name="quantity" defaultValue="1" className="bg-paper/5 border border-paper/20 rounded px-2 py-2 font-mono text-xs text-paper" aria-label="Quantity">
          {Array.from({ length: MAX_VENDOR_QUANTITY }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n} className="bg-ink">
              {n}
            </option>
          ))}
        </select>
      )}
      <button
        type="submit"
        disabled={busy}
        className="flex-1 font-mono text-sm px-4 py-2 rounded bg-gold text-ink font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Opening checkout…" : isService ? "Book now" : "Buy now"}
      </button>
    </form>
  );
}
