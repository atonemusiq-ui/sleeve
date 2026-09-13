import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import Link from "next/link";
import { approveTrackVerification, rejectTrackVerification } from "@/app/actions/admin";

// Same one-person allowlist as app/admin/flagged/page.tsx and
// app/admin/genres/page.tsx — see the former for why this is email-based
// rather than a `role` column.
const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

// The "Verified Human+AI" review queue — tracks land here once an artist
// pays the review fee (app/actions/verification.ts's
// startVerificationCheckout, confirmed by the webhook). Nothing here is
// automatic: the note is exactly what the artist wrote about their own
// human involvement, read and judged by a person.
export default async function VerificationsQueuePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/");
  }

  const admin = createServiceRoleClient();

  const { data: tracks, error } = await admin
    .from("tracks")
    .select(
      "id, title, ai_disclosure, verification_note, verification_requested_at, artists ( profiles ( display_name ) )"
    )
    .eq("verification_status", "pending")
    .order("verification_requested_at", { ascending: true });

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
        <h1 className="font-display text-3xl text-gold">Verified Human+AI review</h1>
        <div className="flex flex-wrap items-center gap-4 font-mono text-sm">
          <Link href="/admin/genres" className="hover:text-gold">
            Genre suggestions
          </Link>
          <Link href="/admin/flagged" className="hover:text-gold">
            Flagged uploads
          </Link>
          <Link href="/dashboard" className="hover:text-gold">
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="ticket-divider mb-10" />

      {error && (
        <p className="text-rust font-mono text-sm">Couldn&apos;t load requests: {error.message}</p>
      )}

      {!error && (!tracks || tracks.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">Nothing pending review.</p>
      )}

      <div className="flex flex-col gap-4">
        {(tracks ?? []).map((track: any) => (
          <div key={track.id} className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display text-lg">{track.title}</p>
                <p className="font-mono text-xs text-paper/60 mt-1">
                  by {track.artists?.profiles?.display_name ?? "unknown"} — disclosed as{" "}
                  {track.ai_disclosure} —{" "}
                  {track.verification_requested_at
                    ? new Date(track.verification_requested_at).toLocaleString()
                    : "unknown time"}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <form action={rejectTrackVerification}>
                  <input type="hidden" name="id" value={track.id} />
                  <button
                    type="submit"
                    className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:bg-paper/10"
                  >
                    Reject
                  </button>
                </form>
                <form action={approveTrackVerification}>
                  <input type="hidden" name="id" value={track.id} />
                  <button
                    type="submit"
                    className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90"
                  >
                    Approve
                  </button>
                </form>
              </div>
            </div>
            {track.verification_note && (
              <p className="font-mono text-xs text-paper/70 mt-3 border-t border-paper/10 pt-3 whitespace-pre-wrap">
                {track.verification_note}
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
