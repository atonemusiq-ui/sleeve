import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { connectRoleLabel } from "@/lib/connectRoles";
import ConnectProfileForm from "./ConnectProfileForm";
import RequestStatusButtons from "./RequestStatusButtons";

export const metadata: Metadata = { title: "My Connect · Fyby" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { new: "New", accepted: "Accepted", declined: "Declined", done: "Done" };

// /connect/me: edit your Connect profile, see requests sent to you and by you.
// Open to every account, artist or not, so managers, designers and
// session players can join without selling music.
export default async function MyConnectPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/connect/me")}`);

  const [{ data: profile }, { data: incoming }, { data: outgoing }] = await Promise.all([
    supabase.from("connect_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("connect_requests")
      .select("id, role, budget_text, deadline, message, contact_email, status, created_at, sender:profiles!connect_requests_from_user_fkey ( display_name )")
      .eq("to_user", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("connect_requests")
      .select("id, to_user, role, status, created_at, recipient:profiles!connect_requests_to_user_fkey ( display_name )")
      .eq("from_user", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const newCount = (incoming ?? []).filter((r: any) => r.status === "new").length;

  return (
    <main className="max-w-4xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-10">
      <div>
        <Link href="/connect" className="font-mono text-xs text-paper/60 hover:text-gold">
          &larr; Fyby Connect
        </Link>
        <h1 className="font-display text-4xl mt-2">🤝 My Connect</h1>
        <p className="text-paper/70 mt-2 max-w-2xl">
          Tell people what you do so they can find you, and answer the requests they send.
          {profile ? (
            <>
              {" "}
              <Link href={`/connect/${user.id}`} className="text-gold underline">
                See your public profile
              </Link>
              .
            </>
          ) : null}
        </p>
      </div>

      <section aria-labelledby="inbox-heading" className="flex flex-col gap-3">
        <h2 id="inbox-heading" className="font-display text-2xl">
          Requests to you {newCount > 0 && <span className="font-mono text-sm text-flame">· {newCount} new</span>}
        </h2>
        {(incoming ?? []).length === 0 ? (
          <p className="font-mono text-xs text-paper/50">No requests yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(incoming ?? []).map((r: any) => (
              <li key={r.id} className="border border-paper/15 rounded-lg p-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {r.sender?.display_name ?? "A Fyby member"} · {connectRoleLabel(r.role)}
                  </span>
                  <span className="font-mono text-[11px] text-paper/50">
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p className="text-paper/80 text-sm whitespace-pre-line">{r.message}</p>
                <p className="font-mono text-[11px] text-paper/55">
                  {[r.budget_text ? `Budget: ${r.budget_text}` : null, r.deadline ? `Needed by ${r.deadline}` : null].filter(Boolean).join(" · ")}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a href={`mailto:${r.contact_email}?subject=${encodeURIComponent("Your Fyby Connect request")}`} className="font-mono text-xs text-gold underline">
                    Reply by email
                  </a>
                  <RequestStatusButtons requestId={r.id} status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="profile-heading" className="flex flex-col gap-3">
        <h2 id="profile-heading" className="font-display text-2xl">
          Your Connect profile
        </h2>
        <ConnectProfileForm profile={(profile as any) ?? null} />
      </section>

      <section aria-labelledby="sent-heading" className="flex flex-col gap-3">
        <h2 id="sent-heading" className="font-display text-2xl">
          Requests you sent
        </h2>
        {(outgoing ?? []).length === 0 ? (
          <p className="font-mono text-xs text-paper/50">
            None yet.{" "}
            <Link href="/connect" className="text-gold underline">
              Find someone to work with
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(outgoing ?? []).map((r: any) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-paper/10 pb-2 text-sm">
                <Link href={`/connect/${r.to_user}`} className="hover:text-gold">
                  {r.recipient?.display_name ?? "Fyby member"} · {connectRoleLabel(r.role)}
                </Link>
                <span className="font-mono text-xs text-paper/55">{STATUS_LABEL[r.status] ?? r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
