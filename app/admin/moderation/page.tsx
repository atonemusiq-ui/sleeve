import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import Link from "next/link";
import { freezeTrack, unfreezeTrack } from "@/app/actions/admin";

// Same one-person allowlist as the other admin/* pages — see
// app/admin/flagged/page.tsx for why this is email-based rather than a
// `role` column.
const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

// The content-moderation back office: freeze a track that shouldn't be up
// (explicit content posted without the disclosure box checked, a rights
// violation, anything against policy) and it disappears from the storefront,
// AI Music page, the artist's public page, and the embed widget — with the
// artist notified why (see app/actions/admin.ts's freezeTrack). Distinct
// from app/admin/flagged/page.tsx, which is the automated duplicate-audio
// detector, not a human content call.
export default async function ContentModerationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/");
  }

  const admin = createServiceRoleClient();

  const [{ data: liveTracks, error: liveError }, { data: frozenTracks, error: frozenError }] =
    await Promise.all([
      admin
        .from("tracks")
        .select("id, title, explicit, genre, created_at, artists ( profiles ( display_name ) )")
        .eq("frozen", false)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("tracks")
        .select("id, title, frozen_reason, frozen_at, artists ( profiles ( display_name ) )")
        .eq("frozen", true)
        .order("frozen_at", { ascending: false }),
    ]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12 flex-wrap gap-4">
        <h1 className="font-display text-3xl text-gold">Content moderation</h1>
        <div className="flex items-center gap-4 font-mono text-sm flex-wrap">
          <Link href="/admin/flagged" className="hover:text-gold">
            Flagged uploads
          </Link>
          <Link href="/admin/videos" className="hover:text-gold">
            Reported videos
          </Link>
          <Link href="/admin/genres" className="hover:text-gold">
            Genre suggestions
          </Link>
          <Link href="/admin/verifications" className="hover:text-gold">
            Verified Human+AI
          </Link>
          <Link href="/dashboard" className="hover:text-gold">
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="ticket-divider mb-10" />

      <section className="mb-14">
        <h2 className="font-display text-xl text-gold mb-1">Frozen tracks</h2>
        <p className="font-mono text-xs text-paper/50 mb-6">
          Pulled from public view. The artist was notified with the reason shown below.
        </p>

        {frozenError && (
          <p className="text-rust font-mono text-sm">Couldn&apos;t load frozen tracks: {frozenError.message}</p>
        )}
        {!frozenError && (!frozenTracks || frozenTracks.length === 0) && (
          <p className="text-paper/50 font-mono text-sm">Nothing currently frozen.</p>
        )}

        <div className="flex flex-col gap-3">
          {(frozenTracks ?? []).map((track: any) => (
            <div
              key={track.id}
              className="border border-rust/40 rounded-lg px-5 py-4 bg-rust/5 flex items-center justify-between gap-4 flex-wrap"
            >
              <div>
                <p className="font-display text-lg">{track.title}</p>
                <p className="font-mono text-xs text-paper/60 mt-1">
                  by {track.artists?.profiles?.display_name ?? "Unknown artist"} — frozen{" "}
                  {track.frozen_at ? new Date(track.frozen_at).toLocaleDateString() : ""}
                </p>
                {track.frozen_reason && (
                  <p className="font-mono text-xs text-rust mt-1">Reason: {track.frozen_reason}</p>
                )}
              </div>
              <form action={unfreezeTrack}>
                <input type="hidden" name="id" value={track.id} />
                <button
                  type="submit"
                  className="font-mono text-xs px-3 py-1.5 rounded border border-forest/50 text-forest hover:bg-forest/10"
                >
                  Unfreeze
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-gold mb-1">Live tracks</h2>
        <p className="font-mono text-xs text-paper/50 mb-6">
          Most recent 200. Freezing requires a reason — it&apos;s sent straight to the artist.
        </p>

        {liveError && (
          <p className="text-rust font-mono text-sm">Couldn&apos;t load tracks: {liveError.message}</p>
        )}

        <div className="flex flex-col gap-3">
          {(liveTracks ?? []).map((track: any) => (
            <details key={track.id} className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 group">
              <summary className="flex items-center justify-between gap-4 flex-wrap cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                <div>
                  <span className="font-display text-lg">{track.title}</span>
                  {track.explicit && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-rust/50 text-rust ml-2">
                      Explicit
                    </span>
                  )}
                  <p className="font-mono text-xs text-paper/60 mt-1">
                    by {track.artists?.profiles?.display_name ?? "Unknown artist"}
                    {track.genre ? ` — ${track.genre}` : ""}
                  </p>
                </div>
                <span className="font-mono text-xs text-gold flex-shrink-0">Freeze &rarr;</span>
              </summary>
              <form action={freezeTrack} className="mt-4 flex flex-col gap-2">
                <input type="hidden" name="id" value={track.id} />
                <label className="font-mono text-xs text-paper/60">
                  Reason (sent to the artist)
                </label>
                <textarea
                  name="reason"
                  required
                  rows={2}
                  placeholder="e.g. Explicit lyrics posted without the explicit-content box checked."
                  className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper text-sm"
                />
                <button
                  type="submit"
                  className="self-start font-mono text-xs px-3 py-1.5 rounded bg-rust text-ink font-medium hover:opacity-90"
                >
                  Freeze &amp; notify artist
                </button>
              </form>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
