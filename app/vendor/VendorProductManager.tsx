"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveVendorProduct, setVendorProductActive, deleteVendorProduct } from "@/app/actions/vendors";
import { MAX_VENDOR_PHOTOS, VENDOR_BUYER_NOTE, VENDOR_RATE_PERCENT, formatCents, vendorSplit } from "@/lib/vendors";
import { safeFileName } from "@/lib/uploadFile";

type Product = {
  id: string;
  title: string;
  description: string | null;
  kind: "product" | "service";
  price_cents: number;
  shipping_cents: number;
  image_urls: string[];
  active: boolean;
  frozen: boolean;
};

const input = "w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper";
const label = "block font-mono text-xs text-paper/60 mb-1";

export default function VendorProductManager({ vendorId, products }: { vendorId: string; products: Product[] }) {
  const [editing, setEditing] = useState<Product | "new" | null>(products.length === 0 ? "new" : null);

  return (
    <div className="flex flex-col gap-4">
      {editing ? (
        <ProductForm
          key={editing === "new" ? "new" : editing.id}
          vendorId={vendorId}
          product={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="self-start bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
        >
          + Add a product or service
        </button>
      )}

      {products.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onEdit={() => setEditing(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className={`border rounded-lg overflow-hidden bg-paper/5 ${product.active ? "border-paper/15" : "border-paper/10 opacity-60"}`}>
      <div className="aspect-[4/3] bg-paper/10">
        {product.image_urls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_urls[0]} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-display text-base">{product.title}</span>
          <span className="font-mono text-sm text-forest flex-shrink-0">{formatCents(product.price_cents)}</span>
        </div>
        <p className="font-mono text-[11px] text-paper/50">
          {product.kind === "service" ? "Service" : `Product · shipping ${formatCents(product.shipping_cents)}`}
          {!product.active && " · Hidden"}
          {product.frozen && " · Under review"}
        </p>
        <div className="flex gap-3 font-mono text-xs">
          <button type="button" onClick={onEdit} className="text-gold hover:underline">Edit</button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => {
                const f = new FormData();
                f.set("productId", product.id);
                f.set("active", String(!product.active));
                return setVendorProductActive(f);
              })
            }
            className="text-paper/60 hover:text-paper disabled:opacity-50"
          >
            {product.active ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete "${product.title}"?`)) return;
              run(() => {
                const f = new FormData();
                f.set("productId", product.id);
                return deleteVendorProduct(f);
              });
            }}
            className="text-paper/60 hover:text-rust disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductForm({ vendorId, product, onDone }: { vendorId: string; product: Product | null; onDone: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<"product" | "service">(product?.kind ?? "product");
  const [price, setPrice] = useState(product ? (product.price_cents / 100).toFixed(2) : "");
  const [shipping, setShipping] = useState(product ? (product.shipping_cents / 100).toFixed(2) : "0.00");
  const [images, setImages] = useState<string[]>(product?.image_urls ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const priceCents = Math.round(Number(price) * 100) || 0;
  const preview = vendorSplit(priceCents, 1, kind === "service" ? 0 : Math.round(Number(shipping) * 100) || 0);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const added: string[] = [];
    for (const file of Array.from(files).slice(0, MAX_VENDOR_PHOTOS - images.length)) {
      if (!file.type.startsWith("image/")) continue;
      const path = `${vendorId}/${Date.now()}-${safeFileName(file.name, "photo")}`;
      const { error: upErr } = await supabase.storage.from("vendor-images").upload(path, file);
      if (upErr) {
        setError(`Photo upload failed: ${upErr.message}`);
        break;
      }
      added.push(supabase.storage.from("vendor-images").getPublicUrl(path).data.publicUrl);
    }
    setImages((prev) => [...prev, ...added].slice(0, MAX_VENDOR_PHOTOS));
    setUploading(false);
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        if (product) formData.set("productId", product.id);
        formData.set("kind", kind);
        formData.delete("imageUrls");
        images.forEach((u) => formData.append("imageUrls", u));
        start(async () => {
          const result = await saveVendorProduct(formData);
          if (result.error) return setError(result.error);
          router.refresh();
          onDone();
        });
      }}
      className="border border-gold/30 rounded-lg p-5 bg-gold/5 flex flex-col gap-4"
    >
      <h3 className="font-display text-lg text-gold">{product ? "Edit listing" : "New listing"}</h3>
      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      <div className="flex gap-2">
        {(["product", "service"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`font-mono text-xs px-3 py-1.5 rounded-full border ${
              kind === k ? "border-gold bg-gold/15 text-gold" : "border-paper/20 text-paper/60"
            }`}
          >
            {k === "product" ? "📦 Product (ships)" : "🗓️ Service (booked)"}
          </button>
        ))}
      </div>

      <div>
        <span className={label}>Photos (up to {MAX_VENDOR_PHOTOS}) — show examples of your work or product</span>
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="relative w-24 h-24 rounded overflow-hidden border border-paper/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                className="absolute top-1 right-1 bg-ink/80 text-paper rounded-full w-6 h-6 text-xs"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX_VENDOR_PHOTOS && (
            <label className="w-24 h-24 rounded border border-dashed border-paper/30 flex flex-col items-center justify-center font-mono text-[11px] text-paper/60 cursor-pointer hover:bg-paper/10">
              {uploading ? "Uploading…" : <>📷<span className="mt-1">Add photos</span></>}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
            </label>
          )}
        </div>
      </div>

      <div>
        <label className={label}>Name</label>
        <input
          name="title"
          defaultValue={product?.title ?? ""}
          required
          maxLength={100}
          placeholder={kind === "service" ? "2-hour event photography package" : "Logo hoodie"}
          className={input}
        />
      </div>

      <div>
        <label className={label}>Description</label>
        <textarea
          name="description"
          defaultValue={product?.description ?? ""}
          rows={3}
          maxLength={2000}
          placeholder={kind === "service" ? "What's included, how long, where you travel to…" : "Sizes, materials, what's in the box…"}
          className={input}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Price ($)</label>
          <input name="price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required placeholder="25.00" className={input} />
        </div>
        {kind === "product" && (
          <div>
            <label className={label}>Shipping per item ($) — paid by the customer</label>
            <input name="shipping" value={shipping} onChange={(e) => setShipping(e.target.value)} inputMode="decimal" className={input} />
          </div>
        )}
      </div>

      {priceCents >= 100 && (
        <p className="font-mono text-xs text-paper/70">
          On a {formatCents(priceCents)} sale you get <span className="text-forest">{formatCents(preview.vendorPayoutCents)}</span>
          {kind === "product" && preview.shippingCents > 0 ? " (including shipping)" : ""}. Fyby&apos;s {VENDOR_RATE_PERCENT}%:{" "}
          {formatCents(preview.platformFeeCents)}. {VENDOR_BUYER_NOTE}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || uploading}
          className="bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : product ? "Save changes" : "Publish listing"}
        </button>
        <button type="button" onClick={onDone} className="font-mono text-xs text-paper/60 hover:text-paper">
          Cancel
        </button>
      </div>
    </form>
  );
}
