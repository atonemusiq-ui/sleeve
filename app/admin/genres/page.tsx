import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import Link from "next/link";
import { approveGenreSuggestion, rejectGenreSuggestion } from "@/app/actions/admin";

// Same one-person allowlist as app/admin/flagged/page.tsx and
// app/admin/videos/page.tsx — see the former for why this is email-based
// rather than a `role` column.
const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

export default async function GenreSuggestionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/");
  }

  const admin = createServiceRoleClient();

  const { data: suggestions, error } = await admin
    .from("genre_suggestions")
    .select("id, suggested_by, suggested_name, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const suggesterIds = [...new Set((suggestions ?? []).map((s) => s.suggested_by).filter(Boolean))];

  const { data: suggesters } = suggesterIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", suggesterIds)
    : { data: [] as { id: string; display_name: string }[] };

  const suggesterNameById = new Map((suggesters ?? []).map((p) => [p.id, p.display_name]));

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <h1 className="font-display text-3xl text-gold">Genre suggestions</h1>
        <div className="flex items-center gap-4 font-mono text-sm">
          <Link href="/admin/flagged" className="hover:text-gold">
            Flagged uploads
          </Link>
          <Link href="/admin/videos" className="hover:text-gold">
            Reported videos
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

      {error && (
        <p className="text-rust font-mono text-sm">Couldn&apos;t load suggestions: {error.message}</p>
      )}

      {!error && (!suggestions || suggestions.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">Nothing pending review.</p>
      )}

      <div className="flex flex-col gap-4">
        {(suggestions ?? []).map((suggestion) => (
          <div
            key={suggestion.id}
            className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="font-display text-lg">{suggestion.suggested_name}</p>
              <p className="font-mono text-xs text-paper/60 mt-1">
                suggested by {suggesterNameById.get(suggestion.suggested_by) ?? "unknown"} —{" "}
                {new Date(suggestion.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <form action={rejectGenreSuggestion}>
                <input type="hidden" name="id" value={suggestion.id} />
                <button
                  type="submit"
                  className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:bg-paper/10"
                >
                  Reject
                </button>
              </form>
              <form action={approveGenreSuggestion}>
                <input type="hidden" name="id" value={suggestion.id} />
                <input type="hidden" name="name" value={suggestion.suggested_name} />
                <button
                  type="submit"
                  className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90"
                >
                  Approve
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
