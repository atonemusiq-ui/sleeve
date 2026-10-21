import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VENDOR_CATEGORIES, isVendorCategory, vendorCategoryLabel } from "@/lib/vendors";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fyby Vendors",
  description: "Photographers, caterers, DJs, clothing brands, studios and more — find the people who can make it happen.",
};

// The public Vendors page (top-bar 🛍️ icon): every live vendor, filterable
// by what they do (lib/vendors.ts VENDOR_CATEGORIES) and searchable.
export default async function VendorsPage({ searchParams }: { searchParams: { c?: string; q?: string } }) {
  const category = isVendorCategory(searchParams.c) ? searchParams.c : null;
  const q = (searchParams.q ?? "").trim().slice(0, 60);

  const supabase = createClient();
  // RLS only returns live vendors (plan active) to the public.
  let query = supabase
    .from("vendors")
    .select("id, business_name, tagline, city, logo_url, categories, plan_status, is_active")
    .eq("plan_status", "active")
    .eq("is_active", true);
  if (category) query = query.contains("categories", [category]);
  if (q) {
    const term = q.replace(/[%,()*]/g, "");
    query = query.or(`business_name.ilike.%${term}%,tagline.ilike.%${term}%`);
  }
  const { data: vendors } = await query.order("created_at", { ascending: false }).limit(200);

  const ids = (vendors ?? []).map((v) => v.id);
  const { data: covers } = ids.length
    ? await supabase.from("vendor_products").select("vendor_id, image_urls").in("vendor_id", ids).eq("active", true).limit(400)
    : { data: [] as any[] };
  const coverByVendor = new Map<string, string>();
  for (const p of covers ?? []) if (!coverByVendor.has(p.vendor_id) && p.image_urls?.[0]) coverByVendor.set(p.vendor_id, p.image_urls[0]);

  return (
    <main className="max-w-5xl lg:max-w-6xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <span className="self-start font-mono text-xs tracking-widest uppercase px-3 py-1 rounded-full bg-flame text-ink font-medium">
          🛍️ Fyby Vendors
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight">Find the people who can make it happen.</h1>
        <p className="text-paper/70 max-w-2xl">
          Photographers, caterers, DJs, clothing brands, studios and more, all on Fyby. Pick what you need below.
        </p>
        <form className="flex gap-2 max-w-lg mt-1">
          {category && <input type="hidden" name="c" value={category} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search vendors…"
            className="flex-1 bg-paper/5 border border-paper/20 rounded-full px-4 py-2 text-paper font-mono text-sm"
          />
          <button className="font-mono text-xs px-4 py-2 rounded-full border border-gold/40 text-gold hover:bg-gold/10">Search</button>
        </form>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Categories">
        <Link
          href={q ? `/vendors?q=${encodeURIComponent(q)}` : "/vendors"}
          className={`font-mono text-xs px-3 py-1.5 rounded-full border ${!category ? "border-gold bg-gold/15 text-gold" : "border-paper/20 text-paper/70 hover:border-gold/50"}`}
        >
          All
        </Link>
        {VENDOR_CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/vendors?c=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`font-mono text-xs px-3 py-1.5 rounded-full border ${
              category === c.slug ? "border-gold bg-gold/15 text-gold" : "border-paper/20 text-paper/70 hover:border-gold/50"
            }`}
          >
            {c.emoji} {c.label}
          </Link>
        ))}
      </nav>

      {(vendors ?? []).length === 0 ? (
        <p className="font-mono text-sm text-paper/50">
          {category || q ? "No vendors match that yet." : "Vendors are joining now."} Are you one?{" "}
          <Link href="/signup?role=vendor" className="text-gold hover:underline">
            Become a Fyby vendor
          </Link>
          .
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(vendors ?? []).map((v) => (
            <Link key={v.id} href={`/vendors/${v.id}`} className="border border-paper/15 rounded-xl overflow-hidden bg-paper/5 hover:border-gold/50 flex flex-col">
              <div className="aspect-[16/10] bg-paper/10">
                {coverByVendor.get(v.id) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverByVendor.get(v.id)} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-4 flex gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-paper/10 flex-shrink-0 flex items-center justify-center">
                  {v.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>🛍️</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg truncate">{v.business_name}</p>
                  {v.tagline && <p className="text-paper/60 text-sm line-clamp-2">{v.tagline}</p>}
                  <p className="font-mono text-[11px] text-paper/50 mt-1 truncate">
                    {[v.city, ...(v.categories ?? []).slice(0, 2).map(vendorCategoryLabel)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="border border-flame/30 bg-flame/5 rounded-xl px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-flame">Sell on Fyby</h2>
          <p className="font-mono text-xs text-paper/70 mt-1">
            $25/month + 12% per sale. Less than Amazon, and no listing, storage or fulfillment fees.
          </p>
        </div>
        <Link href="/signup?role=vendor" className="px-5 py-2.5 rounded-full bg-flame text-ink font-semibold hover:bg-gold">
          Become a vendor
        </Link>
      </section>
    </main>
  );
}
