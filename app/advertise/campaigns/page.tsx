import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setAdPaused } from "@/app/actions/ads";
import { describeTargets } from "@/lib/ads";

export const metadata: Metadata = { title: "My ad campaigns · Fyby" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  pending_payment: "Waiting for payment",
  in_review: "In review",
  active: "Running",
  paused: "Paused",
  rejected: "Not approved",
  refunded: "Not approved · refunded",
  completed: "Finished",
};

// /advertise/campaigns: an advertiser's own campaigns with their totals.
export default async function CampaignsPage({ searchParams }: { searchParams: { paid?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/advertise/campaigns")}`);

  const { data: rows } = await supabase
    .from("ad_campaigns")
    .select("id, brand_name, headline, status, review_note, budget_cents, max_impressions, impressions, clicks, target_genres, target_tags, target_roles, created_at")
    .eq("advertiser_id", user.id)
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false });

  const campaigns = (rows ?? []) as any[];

  return (
    <main className="max-w-5xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/advertise" className="font-mono text-xs text-paper/60 hover:text-gold">
            &larr; Advertise with Fyby
          </Link>
          <h1 className="font-display text-4xl mt-2">My campaigns</h1>
        </div>
        <Link href="/advertise/new" className="px-5 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold">
          New ad
        </Link>
      </div>

      {searchParams.paid === "1" && (
        <p className="font-mono text-sm text-forest">Payment received. Your ad is in review; we&apos;ll notify you when it&apos;s live.</p>
      )}

      {campaigns.length === 0 ? (
        <p className="font-mono text-sm text-paper/60">No campaigns yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {campaigns.map((c) => {
            const spent = Math.min(c.budget_cents, Math.round((c.impressions * c.budget_cents) / Math.max(1, c.max_impressions)));
            const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : "0.0";
            return (
              <li key={c.id} className="border border-paper/15 rounded-lg p-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {c.brand_name} · {c.headline}
                  </span>
                  <span className="font-mono text-xs text-paper/60">{STATUS[c.status] ?? c.status}</span>
                </div>
                <p className="font-mono text-[11px] text-paper/55">
                  Audience: {describeTargets({ genres: c.target_genres ?? [], tags: c.target_tags ?? [], roles: c.target_roles ?? [] })}
                </p>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                  <div>
                    <dt className="text-paper/50">Views</dt>
                    <dd>
                      {c.impressions.toLocaleString("en-US")} / {c.max_impressions.toLocaleString("en-US")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-paper/50">Clicks</dt>
                    <dd>{c.clicks.toLocaleString("en-US")}</dd>
                  </div>
                  <div>
                    <dt className="text-paper/50">Click rate</dt>
                    <dd>{ctr}%</dd>
                  </div>
                  <div>
                    <dt className="text-paper/50">Spent</dt>
                    <dd>
                      ${(spent / 100).toFixed(2)} of ${(c.budget_cents / 100).toFixed(0)}
                    </dd>
                  </div>
                </dl>
                {c.review_note && <p className="font-mono text-[11px] text-rust">{c.review_note}</p>}
                {(c.status === "active" || c.status === "paused") && (
                  <form action={setAdPaused}>
                    <input type="hidden" name="campaignId" value={c.id} />
                    <input type="hidden" name="pause" value={c.status === "active" ? "true" : "false"} />
                    <button className="font-mono text-xs px-3 py-1.5 rounded-full border border-paper/25 hover:border-gold/60">
                      {c.status === "active" ? "Pause" : "Resume"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
