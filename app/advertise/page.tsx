import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { vendorCategoryLabel } from "@/lib/vendors";

export const metadata: Metadata = {
  title: "Advertise with Fyby",
  description: "Reach music fans and musicians by what they love: guitar players, gospel fans, producers and more.",
};

// getfyby.com/advertise: the public pitch to brands, with launch pricing.
export const dynamic = "force-dynamic";

export default async function AdvertisePage() {
  // Fyby Vendors' own links (lib/vendors.ts): every live vendor's website,
  // part of what their Vendor Pro plan includes.
  const supabase = createClient();
  const { data: vendorLinks } = await supabase
    .from("vendors")
    .select("id, business_name, website_url, categories")
    .eq("plan_status", "active")
    .eq("is_active", true)
    .not("website_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <main className="max-w-5xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <span className="self-start font-mono text-xs tracking-widest uppercase px-3 py-1 rounded-full bg-flame text-ink font-medium">
          Advertise with Fyby
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight max-w-3xl">
          Reach the people who actually play, make and buy music.
        </h1>
        <p className="text-paper/75 text-lg max-w-2xl">
          The Fyby Engine shows your sponsored card to the fans and musicians who fit: guitar players, gospel
          listeners, producers, people who go to live shows. You see the results. Nobody&apos;s personal details ever
          leave Fyby.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/advertise/new" className="px-6 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold">
            Create an ad
          </Link>
          <Link href="/advertise/campaigns" className="px-6 py-3 rounded-full border border-paper/25 hover:border-gold/60">
            My campaigns
          </Link>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="grid md:grid-cols-3 gap-4">
        <h2 id="how-heading" className="sr-only">
          How it works
        </h2>
        {[
          ["1. Pick your audience", "Choose genres, music-life interests like \"I play guitar\" or \"Home studio gear\", and Connect roles like producers or drummers. See the estimated reach."],
          ["2. Set a budget and pay", "$10 per 1,000 views, $100 minimum. Paid up front by card; refunded in full if your ad isn't approved."],
          ["3. Go live and track", "Every ad is reviewed first. Then it runs on Discover, Connect, the Merch Booth and artist pages. Track views and clicks anytime."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl bg-ink/70 border border-paper/10 p-5">
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-paper/70 text-sm mt-2">{body}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="pricing-heading" className="flex flex-col gap-3">
        <h2 id="pricing-heading" className="font-display text-2xl">
          Launch pricing
        </h2>
        <div className="overflow-x-auto border border-paper/15 rounded-lg">
          <table className="w-full text-sm">
            <thead className="font-mono text-[11px] uppercase text-paper/50 text-left">
              <tr>
                <th className="px-4 py-2">Ad type</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Where it runs</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-paper/10">
                <td className="px-4 py-3">Sponsored card</td>
                <td className="px-4 py-3">$10 per 1,000 views ($100 minimum)</td>
                <td className="px-4 py-3">Discover, Fyby Connect, Merch Booth, artist pages</td>
              </tr>
              <tr className="border-t border-paper/10">
                <td className="px-4 py-3">Fyby TV video and Radio audio spots</td>
                <td className="px-4 py-3">Coming soon</td>
                <td className="px-4 py-3">Before Fyby TV videos, between songs on Fyby Radio</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="font-mono text-xs text-paper/55">
          30% of every ad dollar spent on an artist&apos;s page goes to that artist.
        </p>
      </section>

      <section aria-labelledby="rules-heading" className="rounded-2xl border border-paper/15 p-5 sm:p-6">
        <h2 id="rules-heading" className="font-display text-xl mb-3">
          Our promise to fans
        </h2>
        <ul className="list-disc pl-5 text-paper/75 text-sm flex flex-col gap-1.5">
          <li>Advertisers get totals only: views, clicks, estimated reach. Never names, emails or profiles.</li>
          <li>Only music interests can be targeted. Never race, religion, health, exact location or money.</li>
          <li>No one under 18, and no one who turns personalization off, sees targeted ads.</li>
          <li>Audiences smaller than 100 people are never shown, so no one can be singled out.</li>
          <li>Every ad is labeled Sponsored, with a &quot;Why this ad?&quot; explanation.</li>
        </ul>
      </section>
      <section aria-labelledby="vendors-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="vendors-heading" className="font-display text-2xl">🛍️ Fyby Vendors</h2>
            <p className="text-paper/70 text-sm mt-1">Businesses selling on Fyby. Tap through to their sites.</p>
          </div>
          <div className="flex gap-2 font-mono text-xs">
            <Link href="/vendors" className="px-3 py-2 rounded-full border border-paper/25 hover:border-gold/60">All vendors</Link>
            <Link href="/signup?role=vendor" className="px-3 py-2 rounded-full bg-flame text-ink font-semibold hover:bg-gold">Become a vendor</Link>
          </div>
        </div>
        {(vendorLinks ?? []).length === 0 ? (
          <p className="font-mono text-xs text-paper/50">Vendor links will appear here as businesses join.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(vendorLinks ?? []).map((v) => (
              <li key={v.id} className="border border-paper/15 rounded-lg px-4 py-3 bg-paper/5 flex flex-col gap-1">
                <Link href={`/vendors/${v.id}`} className="font-display text-base hover:text-gold">{v.business_name}</Link>
                {v.categories?.[0] && <span className="font-mono text-[11px] text-paper/50">{vendorCategoryLabel(v.categories[0])}</span>}
                <a href={v.website_url!} target="_blank" rel="noopener noreferrer nofollow" className="font-mono text-xs text-gold hover:underline truncate">
                  {v.website_url!.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
