import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import Link from "next/link";
import { dismissVideoReport, removeReportedVideo } from "@/app/actions/admin";

// Same one-person allowlist as app/admin/flagged/page.tsx — see that file
// for why this is email-based rather than a `role` column.
const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

export default async function ReportedVideosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/");
  }

  const admin = createServiceRoleClient();

  const { data: reports, error } = await admin
    .from("reported_videos")
    .select("id, artist_id, video_url, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const artistIds = [...new Set((reports ?? []).map((r) => r.artist_id).filter(Boolean))];

  const { data: artists } = artistIds.length
    ? await admin.from("artists").select("id, profiles ( display_name )").in("id", artistIds)
    : { data: [] as any[] };

  const artistNameById = new Map(
    (artists ?? []).map((a) => [a.id, (a as any).profiles?.display_name ?? "Unknown artist"])
  );

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <h1 className="font-display text-3xl text-gold">Reported videos</h1>
        <div className="flex items-center gap-4 font-mono text-sm">
          <Link href="/admin/flagged" className="hover:text-gold">
            Flagged uploads
          </Link>
          <Link href="/admin/genres" className="hover:text-gold">
            Genre suggestions
          </Link>
          <Link href="/admin/verifications" className="hover:text-gold">
            Verified Human+AI
          </Link>
          <Link href="/admin/moderation" className="hover:text-gold">
            Content moderation
          </Link>
          <Link href="/dashboard" className="hover:text-gold">
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="ticket-divider mb-10" />

      {error && (
        <p className="text-rust font-mono text-sm">Couldn&apos;t load reports: {error.message}</p>
      )}

      {!error && (!reports || reports.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">Nothing pending review.</p>
      )}

      <div className="flex flex-col gap-4">
        {(reports ?? []).map((report) => (
          <div
            key={report.id}
            className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="font-display text-lg">{artistNameById.get(report.artist_id) ?? "Unknown artist"}</p>
              {report.video_url && (
                <a
                  href={report.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-paper/60 hover:text-gold break-all"
                >
                  {report.video_url}
                </a>
              )}
              <p className="font-mono text-xs text-paper/40 mt-1">
                reported {new Date(report.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <form action={dismissVideoReport}>
                <input type="hidden" name="id" value={report.id} />
                <button
                  type="submit"
                  className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:bg-paper/10"
                >
                  Dismiss
                </button>
              </form>
              <form action={removeReportedVideo}>
                <input type="hidden" name="id" value={report.id} />
                <input type="hidden" name="artistId" value={report.artist_id} />
                <button
                  type="submit"
                  className="font-mono text-xs px-3 py-1.5 rounded border border-rust/40 text-rust hover:bg-rust/10"
                >
                  Remove video
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
