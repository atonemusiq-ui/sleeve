import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { approveAdCampaign, payArtistAdShares, rejectAdCampaign } from "@/app/actions/ads";
import { artistShareCents, describeTargets } from "@/lib/ads";

const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

export const dynamic = "force-dynamic";

// /admin/ads: review paid campaigns before they run, see what's running, and
// pay artists their 30% share of ads shown on their pages.
export default async function AdsAdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) redirect("/");

  const admin = createServiceRoleClient();
  const [{ data: queue }, { data: running }, { data: artistEvents }, { data: payouts }] = await Promise.all([
    admin
      .from("ad_campaigns")
      .select("id, brand_name, headline, body, click_url, image_url, budget_cents, target_genres, target_tags, target_roles, created_at, profiles ( display_name )")
      .eq("status", "in_review")
      .order("created_at", { ascending: true }),
    admin
      .from("ad_campaigns")
      .select("id, brand_name, headline, status, impressions, max_impressions, clicks, budget_cents")
      .in("status", ["active", "paused", "completed"])
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("ad_events").select("artist_id").eq("kind", "impression").not("artist_id", "is", null).limit(100000),
    admin.from("ad_artist_payouts").select("amount_cents"),
  ]);

  const artistImpressions = (artistEvents ?? []).length;
  const paidOut = (payouts ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const owed = Math.max(0, artistShareCents(artistImpressions) - paidOut);

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-10">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-gold">Ads</h1>
        <Link href="/advertise" className="font-mono text-sm hover:text-gold">
          Advertiser page
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Waiting for review ({(queue ?? []).length})</h2>
        {(queue ?? []).length === 0 && <p className="font-mono text-xs text-paper/50">Nothing to review.</p>}
        {(queue ?? []).map((c: any) => (
          <div key={c.id} className="border border-paper/15 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex gap-4 items-center">
              {c.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_url} alt="" className="h-20 w-20 rounded-xl object-cover" />
              )}
              <div>
                <p className="font-mono text-[10px] uppercase text-paper/50">Sponsored · {c.brand_name}</p>
                <p className="font-semibold">{c.headline}</p>
                {c.body && <p className="text-paper/70 text-sm">{c.body}</p>}
                <a href={c.click_url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-gold underline break-all">
                  {c.click_url}
                </a>
              </div>
            </div>
            <p className="font-mono text-[11px] text-paper/55">
              ${(c.budget_cents / 100).toFixed(0)} · from {c.profiles?.display_name ?? "member"} · audience:{" "}
              {describeTargets({ genres: c.target_genres ?? [], tags: c.target_tags ?? [], roles: c.target_roles ?? [] })}
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <form action={approveAdCampaign}>
                <input type="hidden" name="campaignId" value={c.id} />
                <button className="font-mono text-xs px-4 py-2 rounded-full bg-forest text-ink font-medium">Approve</button>
              </form>
              <form action={rejectAdCampaign} className="flex flex-wrap gap-2 items-end">
                <input type="hidden" name="campaignId" value={c.id} />
                <input name="note" placeholder="Reason (sent to advertiser)" className="bg-ink border border-paper/25 rounded px-2 py-1.5 text-xs w-64" />
                <button className="font-mono text-xs px-4 py-2 rounded-full border border-rust/60 text-rust">Reject and refund</button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Artist ad share</h2>
        <p className="font-mono text-xs text-paper/60">
          {artistImpressions.toLocaleString("en-US")} ad views on artist pages · ${(paidOut / 100).toFixed(2)} paid ·
          about ${(owed / 100).toFixed(2)} owed (artists under $1 roll over).
        </p>
        <form action={payArtistAdShares}>
          <button className="font-mono text-xs px-4 py-2 rounded-full bg-flame text-ink font-medium">Pay artists their 30% now</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Campaigns</h2>
        {(running ?? []).length === 0 ? (
          <p className="font-mono text-xs text-paper/50">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(running ?? []).map((c: any) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 border-b border-paper/10 pb-2 text-sm">
                <span>
                  {c.brand_name} · {c.headline}
                </span>
                <span className="font-mono text-xs text-paper/60">
                  {c.status} · {c.impressions}/{c.max_impressions} views · {c.clicks} clicks · ${(c.budget_cents / 100).toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
