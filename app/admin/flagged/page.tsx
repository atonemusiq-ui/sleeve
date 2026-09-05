import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import Link from "next/link";
import { dismissFlag, confirmDuplicateFlag } from "@/app/actions/admin";

// Restricted to your own account rather than a `role` column on profiles —
// this is a one-person moderation queue for now, and an email allowlist is
// one line to extend later (or swap for a real `is_admin` column) without
// having to migrate anything if that ever changes.
const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

export default async function FlaggedUploadsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/");
  }

  const admin = createServiceRoleClient();

  const { data: flags, error } = await admin
    .from("flagged_uploads")
    .select("id, new_track_title, similarity_score, status, created_at, uploader_id, matched_track_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const uploaderIds = [...new Set((flags ?? []).map((f) => f.uploader_id).filter(Boolean))];
  const matchedTrackIds = [...new Set((flags ?? []).map((f) => f.matched_track_id).filter(Boolean))];

  const [{ data: uploaders }, { data: matchedTracks }] = await Promise.all([
    uploaderIds.length
      ? admin.from("profiles").select("id, display_name").in("id", uploaderIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    matchedTrackIds.length
      ? admin.from("tracks").select("id, title").in("id", matchedTrackIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const uploaderById = new Map((uploaders ?? []).map((u) => [u.id, u.display_name]));
  const trackById = new Map((matchedTracks ?? []).map((t) => [t.id, t.title]));

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <h1 className="font-display text-3xl text-gold">Flagged uploads</h1>
        <Link href="/dashboard" className="font-mono text-sm hover:text-gold">
          Back to dashboard
        </Link>
      </header>

      <div className="ticket-divider mb-10" />

      {error && (
        <p className="text-rust font-mono text-sm">Couldn&apos;t load flags: {error.message}</p>
      )}

      {!error && (!flags || flags.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">Nothing pending review.</p>
      )}

      <div className="flex flex-col gap-4">
        {(flags ?? []).map((flag) => (
          <div
            key={flag.id}
            className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-display text-lg">{flag.new_track_title}</p>
              <p className="font-mono text-xs text-paper/60 mt-1">
                uploaded by {uploaderById.get(flag.uploader_id) ?? "unknown"} — matches{" "}
                <span className="text-paper">
                  {trackById.get(flag.matched_track_id) ?? "a deleted track"}
                </span>{" "}
                at {flag.similarity_score != null ? Math.round(flag.similarity_score * 100) : "?"}%
                similarity
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <form action={dismissFlag}>
                <input type="hidden" name="id" value={flag.id} />
                <button
                  type="submit"
                  className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:bg-paper/10"
                >
                  Dismiss
                </button>
              </form>
              <form action={confirmDuplicateFlag}>
                <input type="hidden" name="id" value={flag.id} />
                <button
                  type="submit"
                  className="font-mono text-xs px-3 py-1.5 rounded border border-rust/40 text-rust hover:bg-rust/10"
                >
                  Confirm duplicate
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
