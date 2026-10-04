import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CONNECT_ROLES, CONNECT_ROLE_GROUPS, connectRoleLabel, isConnectRole } from "@/lib/connectRoles";
import { GENRES, isValidGenre } from "@/lib/genres";

export const metadata: Metadata = {
  title: "Fyby Connect",
  description: "Find producers, players, engineers, singers, designers and managers to work with.",
};

export const dynamic = "force-dynamic";

type SearchParams = { role?: string; genre?: string; remote?: string; q?: string };

// getfyby.com/connect: "I'm looking for a…" search across Connect profiles.
export default async function ConnectPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const role = isConnectRole(searchParams.role) ? searchParams.role : "";
  const genre = isValidGenre(searchParams.genre) ? searchParams.genre : "";
  const remoteOnly = searchParams.remote === "1";
  const q = (searchParams.q ?? "").trim().slice(0, 60);

  let query = supabase
    .from("connect_profiles")
    .select("user_id, headline, roles, genres, rate_text, location, remote, updated_at, profiles ( display_name, role, artists ( id, bio_photo_url ) )")
    .eq("available", true)
    .order("updated_at", { ascending: false })
    .limit(60);

  if (role) query = query.contains("roles", [role]);
  if (genre) query = query.contains("genres", [genre]);
  if (remoteOnly) query = query.eq("remote", true);
  if (q) query = query.or(`headline.ilike.%${q.replace(/[%,()]/g, "")}%,location.ilike.%${q.replace(/[%,()]/g, "")}%`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: rows } = await query;
  const members = (rows ?? []) as any[];

  const selectClass = "bg-ink border border-paper/25 rounded-lg px-3 py-2.5 text-paper text-sm";

  return (
    <main className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <span className="self-start font-mono text-xs tracking-widest uppercase px-3 py-1 rounded-full bg-flame text-ink font-medium">
          🤝 Fyby Connect
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight">Find your people.</h1>
        <p className="text-paper/70 text-lg max-w-2xl">
          Producers, players, singers, engineers, designers and managers, all on Fyby. Search by what you need, then
          send a request.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/connect/me" className="px-5 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold">
            {user ? "My Connect profile and requests" : "Join Connect"}
          </Link>
        </div>
      </section>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-paper/15 p-4">
        <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
          I&apos;m looking for a…
          <select name="role" defaultValue={role} className={selectClass}>
            <option value="">Anyone</option>
            {CONNECT_ROLE_GROUPS.map((g) => (
              <optgroup key={g.key} label={g.label}>
                {CONNECT_ROLES.filter((r) => r.group === g.key).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
          Genre
          <select name="genre" defaultValue={genre} className={selectClass}>
            <option value="">Any genre</option>
            {GENRES.filter((g) => g !== "Covers" && g !== "Other").map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
          Keyword or city
          <input name="q" defaultValue={q} placeholder="e.g. Los Angeles" className={selectClass} />
        </label>
        <label className="flex items-center gap-2 font-mono text-xs text-paper/70 min-h-[44px]">
          <input type="checkbox" name="remote" value="1" defaultChecked={remoteOnly} className="h-4 w-4" />
          Works remotely
        </label>
        <button type="submit" className="min-h-[44px] px-5 rounded-full bg-paper text-ink font-semibold hover:bg-gold">
          Search
        </button>
      </form>

      <section aria-label="Results">
        {members.length === 0 ? (
          <p className="font-mono text-sm text-paper/60">
            No one matches yet.{" "}
            <Link href="/connect/me" className="text-gold underline">
              Add your own profile
            </Link>{" "}
            so others can find you.
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => {
              const name = m.profiles?.display_name ?? "Fyby member";
              const artist = Array.isArray(m.profiles?.artists) ? m.profiles.artists[0] : m.profiles?.artists;
              return (
                <li key={m.user_id} className="rounded-2xl bg-ink/70 border border-paper/10 p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-paper/10 overflow-hidden flex items-center justify-center shrink-0">
                      {artist?.bio_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={artist.bio_photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display text-lg text-paper/60">{name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/connect/${m.user_id}`} className="font-semibold text-lg hover:text-gold block truncate">
                        {name}
                      </Link>
                      <span className="font-mono text-[11px] text-paper/50">
                        {m.location ?? ""}
                        {m.location && m.remote ? " · " : ""}
                        {m.remote ? "Remote OK" : ""}
                      </span>
                    </div>
                  </div>
                  {m.headline && <p className="text-paper/75 text-sm">{m.headline}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {(m.roles ?? []).map((r: string) => (
                      <span key={r} className={`font-mono text-[11px] px-2 py-0.5 rounded-full border ${r === role ? "border-flame text-flame" : "border-paper/20 text-paper/60"}`}>
                        {connectRoleLabel(r)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="font-mono text-xs text-forest">{m.rate_text ?? ""}</span>
                    <Link href={`/connect/${m.user_id}`} className="font-mono text-xs px-3 py-2 rounded-full bg-flame text-ink font-medium hover:bg-gold">
                      View &amp; request
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
