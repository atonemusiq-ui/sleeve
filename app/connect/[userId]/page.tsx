import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { connectRoleLabel } from "@/lib/connectRoles";
import ConnectRequestForm from "./ConnectRequestForm";

export const dynamic = "force-dynamic";

async function loadMember(userId: string) {
  if (!isUuid(userId)) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("connect_profiles")
    .select("user_id, headline, roles, genres, rate_text, location, remote, sample_url, available, profiles ( display_name, artists ( id, bio, bio_photo_url, is_active ) )")
    .eq("user_id", userId)
    .maybeSingle();
  return data as any;
}

export async function generateMetadata({ params }: { params: { userId: string } }): Promise<Metadata> {
  const m = await loadMember(params.userId);
  const name = m?.profiles?.display_name ?? "Fyby member";
  return { title: `${name} · Fyby Connect`, description: m?.headline ?? `Work with ${name} on Fyby Connect.` };
}

export default async function ConnectMemberPage({ params }: { params: { userId: string } }) {
  const m = await loadMember(params.userId);
  if (!m) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = m.profiles?.display_name ?? "Fyby member";
  const artist = Array.isArray(m.profiles?.artists) ? m.profiles.artists[0] : m.profiles?.artists;
  const isSelf = user?.id === m.user_id;

  return (
    <main className="max-w-4xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-8">
      <Link href="/connect" className="font-mono text-xs text-paper/60 hover:text-gold">
        &larr; Fyby Connect
      </Link>

      <section className="flex flex-col sm:flex-row gap-6 sm:items-center">
        <div className="h-24 w-24 rounded-full bg-paper/10 overflow-hidden flex items-center justify-center shrink-0">
          {artist?.bio_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artist.bio_photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-3xl text-paper/60">{name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-bold">{name}</h1>
          {m.headline && <p className="text-paper/80 text-lg">{m.headline}</p>}
          <p className="font-mono text-xs text-paper/55">
            {[m.location, m.remote ? "Works remotely" : null, m.rate_text].filter(Boolean).join(" · ")}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl">Available for</h2>
        <div className="flex flex-wrap gap-2">
          {(m.roles ?? []).map((r: string) => (
            <span key={r} className="font-mono text-xs px-3 py-1.5 rounded-full border border-flame/50 text-flame">
              {connectRoleLabel(r)}
            </span>
          ))}
        </div>
        {(m.genres ?? []).length > 0 && (
          <p className="font-mono text-xs text-paper/55">Genres: {(m.genres as string[]).join(", ")}</p>
        )}
        <div className="flex flex-wrap gap-4 font-mono text-sm">
          {artist?.id && artist.is_active !== false && (
            <Link href={`/artists/${artist.id}`} className="text-gold hover:underline">
              Hear their music on Fyby &rarr;
            </Link>
          )}
          {m.sample_url && (
            <a href={m.sample_url} target="_blank" rel="noopener noreferrer nofollow" className="text-gold hover:underline">
              Portfolio / samples &rarr;
            </a>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-paper/15 p-5 sm:p-6">
        <h2 className="font-display text-xl mb-4">Send a request</h2>
        {isSelf ? (
          <p className="font-mono text-sm text-paper/60">
            This is your profile.{" "}
            <Link href="/connect/me" className="text-gold underline">
              Edit it or see your requests
            </Link>
            .
          </p>
        ) : !m.available ? (
          <p className="font-mono text-sm text-paper/60">{name} isn&apos;t taking requests right now.</p>
        ) : !user ? (
          <p className="font-mono text-sm text-paper/60">
            <Link href={`/login?next=${encodeURIComponent(`/connect/${m.user_id}`)}`} className="text-gold underline">
              Log in
            </Link>{" "}
            to send {name} a request.
          </p>
        ) : (
          <ConnectRequestForm toUser={m.user_id} name={name} roles={m.roles ?? []} />
        )}
      </section>
    </main>
  );
}
