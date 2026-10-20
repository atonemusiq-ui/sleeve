import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { REMOVED_BY_ARTIST } from "@/lib/trackRemoval";
import { freezeTrack } from "@/app/actions/admin";
import { addAdmin, removeAdmin } from "@/app/actions/adminTeam";

export const dynamic = "force-dynamic";

type CountResult = { count: number | null };

// The back office home: what needs attention, quick song search with a
// one-step Flag & freeze, the team, and recent activity.
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: { q?: string; teamError?: string };
}) {
  const me = await requireAdminPage();
  const db = createServiceRoleClient();
  const q = (searchParams.q ?? "").trim().slice(0, 80);

  const count = (p: PromiseLike<CountResult>) => Promise.resolve(p).then((r) => r.count ?? 0).catch(() => 0);

  const [
    flagged,
    videos,
    genres,
    verifications,
    ads,
    frozen,
    liveSongs,
    artists,
    members,
    { data: team },
    { data: activity },
    { data: results },
  ] = await Promise.all([
    count(db.from("flagged_uploads").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(db.from("reported_videos").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(db.from("genre_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(db.from("tracks").select("id", { count: "exact", head: true }).eq("verification_status", "pending")),
    count(db.from("ad_campaigns").select("id", { count: "exact", head: true }).eq("status", "in_review")),
    count(
      db
        .from("tracks")
        .select("id", { count: "exact", head: true })
        .eq("frozen", true)
        .or(`frozen_reason.is.null,frozen_reason.neq.${REMOVED_BY_ARTIST}`)
    ),
    count(db.from("tracks").select("id", { count: "exact", head: true }).eq("frozen", false)),
    count(db.from("artists").select("id", { count: "exact", head: true })),
    count(db.from("profiles").select("id", { count: "exact", head: true })),
    db.from("admin_users").select("email, role, added_by, created_at").order("created_at"),
    db.from("admin_log").select("actor_email, action, detail, created_at").order("created_at", { ascending: false }).limit(12),
    q
      ? db
          .from("tracks")
          .select("id, title, frozen, created_at, artists ( profiles ( display_name ) )")
          .ilike("title", `%${q.replace(/[%_]/g, "")}%`)
          .order("created_at", { ascending: false })
          .limit(15)
      : Promise.resolve({ data: null }),
  ]);

  const queues = [
    { label: "Flagged uploads", hint: "Possible duplicate or copied songs", n: flagged, href: "/admin/flagged", icon: "🚩" },
    { label: "Reported videos", hint: "Fans reported an artist video", n: videos, href: "/admin/videos", icon: "🎬" },
    { label: "Verified Human+AI", hint: "Badge requests to review", n: verifications, href: "/admin/verifications", icon: "✅" },
    { label: "Genre suggestions", hint: "New genres artists asked for", n: genres, href: "/admin/genres", icon: "🏷️" },
    { label: "Ads to approve", hint: "Paid campaigns waiting", n: ads, href: "/admin/ads", icon: "📣" },
  ];
  const waiting = queues.reduce((sum, x) => sum + x.n, 0);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl text-paper">Back office</h1>
      <p className="font-mono text-xs text-paper/50 mt-1 mb-8">
        {waiting === 0 ? "All caught up — nothing waiting on the team." : `${waiting} item${waiting === 1 ? "" : "s"} waiting on the team.`}
      </p>

      {/* At a glance */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <Stat label="Members" value={members} />
        <Stat label="Artists" value={artists} />
        <Stat label="Live songs" value={liveSongs} />
        <Stat label="Frozen songs" value={frozen} tone={frozen > 0 ? "rust" : undefined} href="/admin/moderation" />
      </section>

      {/* Needs attention */}
      <section className="mb-12">
        <h2 className="font-display text-xl text-gold mb-4">Needs attention</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {queues.map((x) => (
            <Link
              key={x.href}
              href={x.href}
              className={`rounded-xl border px-4 py-4 flex items-center gap-4 hover:border-gold/60 ${
                x.n > 0 ? "border-gold/40 bg-gold/5" : "border-paper/15 bg-paper/5"
              }`}
            >
              <span className="text-2xl" aria-hidden>{x.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-mono text-sm text-paper">{x.label}</span>
                <span className="block font-mono text-[11px] text-paper/50">{x.hint}</span>
              </span>
              <span
                className={`font-mono text-sm min-w-[2rem] text-center px-2 py-0.5 rounded-full ${
                  x.n > 0 ? "bg-gold text-ink" : "bg-paper/10 text-paper/50"
                }`}
              >
                {x.n}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Find & flag a song */}
      <section className="mb-12">
        <h2 className="font-display text-xl text-gold mb-1">Find &amp; flag a song</h2>
        <p className="font-mono text-xs text-paper/50 mb-4">
          Flagging freezes the song — it comes off the storefront right away, and the artist gets your reason.
        </p>
        <form className="flex gap-2 mb-4">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search songs by title…"
            className="flex-1 bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
          <button type="submit" className="bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2 hover:opacity-90">
            Search
          </button>
        </form>

        {q && (results ?? []).length === 0 && (
          <p className="font-mono text-sm text-paper/50">No songs match “{q}”.</p>
        )}
        <div className="flex flex-col gap-2">
          {(results ?? []).map((t: any) => (
            <details key={t.id} className="border border-paper/15 rounded-lg px-4 py-3 bg-paper/5">
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="font-display text-base">{t.title}</span>
                  <span className="block font-mono text-[11px] text-paper/50">
                    by {t.artists?.profiles?.display_name ?? "Unknown artist"}
                  </span>
                </span>
                {t.frozen ? (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full border border-rust/50 text-rust">Frozen</span>
                ) : (
                  <span className="font-mono text-xs px-3 py-1 rounded border border-rust/50 text-rust">🚩 Flag</span>
                )}
              </summary>
              {t.frozen ? (
                <p className="font-mono text-xs text-paper/60 mt-3">
                  Already frozen. Unfreeze it from{" "}
                  <Link href="/admin/moderation" className="text-gold underline">Songs</Link>.
                </p>
              ) : (
                <form action={freezeTrack} className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input
                    name="reason"
                    required
                    placeholder="Reason the artist will see (e.g. explicit lyrics not marked Explicit)"
                    className="flex-1 bg-ink border border-paper/20 rounded px-3 py-2 text-paper text-sm"
                  />
                  <button type="submit" className="font-mono text-xs px-4 py-2 rounded bg-rust text-paper hover:opacity-90">
                    Flag &amp; freeze
                  </button>
                </form>
              )}
            </details>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Team */}
        <section>
          <h2 className="font-display text-xl text-gold mb-1">Admin team</h2>
          <p className="font-mono text-xs text-paper/50 mb-4">
            Owners manage the team. Moderators can do everything else.
          </p>
          {searchParams.teamError && <p className="font-mono text-sm text-rust mb-3">{searchParams.teamError}</p>}
          <div className="flex flex-col gap-2 mb-4">
            {(team ?? []).map((a: any) => (
              <div key={a.email} className="flex items-center justify-between gap-3 border border-paper/15 rounded-lg px-4 py-2.5 bg-paper/5">
                <span className="min-w-0">
                  <span className="block font-mono text-sm text-paper truncate">{a.email}</span>
                  <span className="block font-mono text-[11px] text-paper/50">
                    {a.role === "owner" ? "Owner" : "Moderator"}
                    {a.email === me.email ? " · you" : ""}
                  </span>
                </span>
                {me.role === "owner" && a.email !== me.email && a.added_by !== "setup" && (
                  <form action={removeAdmin}>
                    <input type="hidden" name="email" value={a.email} />
                    <button type="submit" className="font-mono text-[11px] px-2.5 py-1 rounded border border-paper/20 hover:border-rust/60 hover:text-rust">
                      Remove
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
          {me.role === "owner" && (
            <form action={addAdmin} className="flex flex-col sm:flex-row gap-2">
              <input
                name="email"
                type="email"
                required
                placeholder="New admin's email"
                className="flex-1 bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper text-sm"
              />
              <select name="role" defaultValue="moderator" className="bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono text-sm">
                <option value="moderator" className="bg-ink">Moderator</option>
                <option value="owner" className="bg-ink">Owner</option>
              </select>
              <button type="submit" className="bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2 hover:opacity-90">
                Add
              </button>
            </form>
          )}
          {me.role === "owner" && (
            <p className="font-mono text-[11px] text-paper/40 mt-2">
              They sign up on Fyby with that email, then sign in at Admin login.
            </p>
          )}
        </section>

        {/* Activity */}
        <section>
          <h2 className="font-display text-xl text-gold mb-4">Recent activity</h2>
          {(activity ?? []).length === 0 ? (
            <p className="font-mono text-sm text-paper/50">Nothing yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(activity ?? []).map((a: any, i: number) => (
                <li key={i} className="font-mono text-xs border-l-2 border-gold/40 pl-3 py-0.5">
                  <span className="text-paper">{a.action}</span>
                  {a.detail && <span className="text-paper/60"> · {a.detail}</span>}
                  <span className="block text-[11px] text-paper/40">
                    {a.actor_email} · {new Date(a.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "short", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: number; tone?: "rust"; href?: string }) {
  const body = (
    <>
      <span className={`block font-display text-3xl ${tone === "rust" ? "text-rust" : "text-paper"}`}>
        {value.toLocaleString()}
      </span>
      <span className="block font-mono text-[11px] text-paper/50 mt-1 uppercase tracking-wider">{label}</span>
    </>
  );
  const cls = "rounded-xl border border-paper/15 bg-paper/5 px-4 py-4 block";
  return href ? (
    <Link href={href} className={`${cls} hover:border-gold/60`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
