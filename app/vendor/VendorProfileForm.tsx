"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateVendorProfile } from "@/app/actions/vendors";
import { VENDOR_CATEGORIES } from "@/lib/vendors";
import { safeFileName } from "@/lib/uploadFile";

type Vendor = {
  id: string;
  business_name: string;
  tagline: string | null;
  bio: string | null;
  logo_url: string | null;
  website_url: string | null;
  city: string | null;
  categories: string[];
};

const input = "w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper";
const label = "block font-mono text-xs text-paper/60 mb-1";

export default function VendorProfileForm({ vendor }: { vendor: Vendor }) {
  const [logoUrl, setLogoUrl] = useState(vendor.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function uploadLogo(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file for your logo.");
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${vendor.id}/logo-${Date.now()}-${safeFileName(file.name, "logo")}`;
    const { error: upErr } = await supabase.storage.from("vendor-images").upload(path, file);
    setUploading(false);
    if (upErr) return setError(`Logo upload failed: ${upErr.message}`);
    setLogoUrl(supabase.storage.from("vendor-images").getPublicUrl(path).data.publicUrl);
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        setSaved(false);
        formData.set("logoUrl", logoUrl);
        start(async () => {
          const result = await updateVendorProfile(formData);
          if (result.error) setError(result.error);
          else setSaved(true);
        });
      }}
      className="flex flex-col gap-4"
    >
      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-paper/10 border border-paper/15 flex-shrink-0 flex items-center justify-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🛍️</span>
          )}
        </div>
        <label className="font-mono text-xs px-3 py-2 rounded border border-paper/30 text-paper/80 hover:bg-paper/10 cursor-pointer">
          {uploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Business name</label>
          <input name="businessName" defaultValue={vendor.business_name} required maxLength={80} className={input} />
        </div>
        <div>
          <label className={label}>City / area you serve</label>
          <input name="city" defaultValue={vendor.city ?? ""} maxLength={80} placeholder="Los Angeles, CA" className={input} />
        </div>
      </div>

      <div>
        <label className={label}>Tagline</label>
        <input
          name="tagline"
          defaultValue={vendor.tagline ?? ""}
          maxLength={120}
          placeholder="Event photography for artists and churches"
          className={input}
        />
      </div>

      <div>
        <label className={label}>About your business</label>
        <textarea name="bio" defaultValue={vendor.bio ?? ""} rows={4} maxLength={2000} className={input} />
      </div>

      <div>
        <label className={label}>Your website or shop link</label>
        <input
          name="websiteUrl"
          defaultValue={vendor.website_url ?? ""}
          placeholder="https://yourbusiness.com"
          inputMode="url"
          className={input}
        />
        <p className="font-mono text-[11px] text-paper/50 mt-1">Shown on your Fyby page and the Fyby advertising page.</p>
      </div>

      <fieldset>
        <legend className={label}>What do you do? Check everything that fits — this is how customers find you.</legend>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
          {VENDOR_CATEGORIES.map((c) => (
            <label
              key={c.slug}
              className="flex items-center gap-2 font-mono text-xs text-paper/80 border border-paper/15 rounded px-3 py-2 has-[:checked]:border-gold/60 has-[:checked]:bg-gold/10"
            >
              <input type="checkbox" name="categories" value={c.slug} defaultChecked={vendor.categories?.includes(c.slug)} className="accent-gold" />
              <span>
                {c.emoji} {c.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || uploading}
          className="bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
        {saved && <span className="font-mono text-xs text-forest">✓ Saved</span>}
      </div>
    </form>
  );
}
