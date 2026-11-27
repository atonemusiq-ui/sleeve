import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// Search for artists and creatives (Fyby Connect profiles).
// Matches on display name, plus Connect headline and roles. Fans who have
// neither an artist page nor a Connect profile never show up here.
// Reads only tables that are already publicly readable under RLS:
// profiles (all), artists (active ones), connect_profiles (available ones).

type Person = {
  id: string; // profiles.id (the user id)
  name: string;
  artist: { id: string; bio: string | null; bio_photo_url: string | null } | null;
  connect: { headline: string | null; roles: string[]; location: string | null; remote: boolean | null } | null;
};

// Keep the query safe to drop into a PostgREST .or()/.ilike() filter:
// commas, parentheses and wildcards have special meaning there.
function cleanQuery(raw: string) {
  return raw.replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string };
}) {
  const supabase = createClient();
  const q = cleanQuery(searchParams.q ?? "");
  const role = (searchParams.role ?? "").trim();

  const select =
    "id, display_name, artists ( id, bio, bio_photo_url, is_active ), connect_profiles ( headline, roles, location, remote, available )";

  // Role chips come from the roles people have actually picked on their
  // Connect profiles, so this never drifts from the Connect form's list.
  const { data: roleRows } = await supabase.from("connect_profiles").select("roles").eq("available", true);
  const allRoles = Array.from(
    new Set((roleRows ?? []).flatMap((r: any) => (Array.isArray(r.roles) ? r.roles : [])))
  ).sort((a, b) => a.localeCompare(b));

  const rows: any[] = [];

  if (q || role) {
    // 1) People whose name matches.
    if (q) {
      const { data } = await supabase.from("profiles").select(select).ilike("display_name", `%${q}%`).limit(50);
      rows.push(...(data ?? []));
    }

    // 2) Creatives whose Connect headline matches, or who have the chosen role.
    let connectQuery = supabase.from("connect_profiles").select("user_id").eq("available", true);
    if (role) connectQuery = connectQuery.contains("roles", [role]);
    if (q) connectQuery = connectQuery.ilike("headline", `%${q}%`);
    const { data: connectRows } = await connectQuery.limit(50);
    const ids = (connectRows ?? []).map((r: any) => r.user_id);
    if (ids.length > 0) {
      const { data } = await supabase.from("profiles").select(select).in("id", ids);
      rows.push(...(data ?? []));
    }
  }

  // Merge, normalize, and keep only artists and creatives.
  const byId = new Map<string, Person>();
  for (const row of rows) {
    if (byId.has(row.id)) continue;
    const artistRow = one<any>(row.artists);
    const connectRow = one<any>(row.connect_profiles);
    const artist =
      artistRow && artistRow.is_active !== false
        ? { id: artistRow.id, bio: artistRow.bio, bio_photo_url: artistRow.bio_photo_url }
        : null;
    const connect =
      connectRow && connectRow.available !== false
        ? {
            headline: connectRow.headline,
            roles: Array.isArray(connectRow.roles) ? connectRow.roles : [],
            location: connectRow.location,
            remote: connectRow.remote,
          }
        : null;
    if (!artist && !connect) continue;
    if (role && !connect?.roles.includes(role)) continue;
    byId.set(row.id, { id: row.id, name: row.display_name ?? "Unnamed", artist, connect });
  }
  const people = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));

  const chipHref = (r: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (r && r !== role) params.set("role", r);
    const s = params.toString();
    return s ? `/search?${s}` : "/search";
  };

  return (
    <main className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 py-12">
      <header className="flex items-center justify-between mb-10">
        <Link href="/" className="font-mono text-xs text-paper/50 hover:text-gold">
          &larr; Back to Fyby
        </Link>
      </header>

      <h1 className="font-display text-3xl text-gold mb-2">Find artists &amp; people</h1>
      <p className="font-mono text-xs text-paper/50 mb-6 max-w-xl">
        Search by name, or by what someone does — producer, mixer, lyricist, designer and more.
      </p>

      <form action="/search" method="get" className="flex gap-2 mb-5 max-w-xl">
        {role && <input type="hidden" name="role" value={role} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search artists or people…"
          autoFocus
          className="flex-1 bg-paper/5 border border-paper/20 rounded-md px-4 py-2.5 text-paper placeholder:text-paper/30 focus:outline-none focus:border-gold"
        />
        <button
          type="submit"
          className="font-mono text-sm px-4 py-2.5 rounded-md bg-gold text-fyby hover:opacity-90"
        >
          Search
        </button>
      </form>

      {allRoles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          {allRoles.map((r) => (
            <Link
              key={r}
              href={chipHref(r)}
              className={`font-mono text-xs px-3 py-1 rounded-full border ${
                r === role ? "border-gold text-gold bg-gold/10" : "border-paper/20 text-paper/60 hover:border-gold/50"
              }`}
            >
              {r}
            </Link>
          ))}
        </div>
      )}

      {!q && !role && (
        <p className="text-paper/40 font-mono text-sm">
          Type a name above, or{" "}
          <Link href="/artists" className="text-gold">
            browse all artists
          </Link>
          .
        </p>
      )}

      {(q || role) && people.length === 0 && (
        <p className="text-paper/50 font-mono text-sm">
          No artists or people found{q ? ` for “${q}”` : ""}
          {role ? ` with the role “${role}”` : ""}.
        </p>
      )}

      {people.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {people.map((p) => {
            const href = p.artist ? `/artists/${p.artist.id}` : "/connect";
            const blurb = p.connect?.headline || p.artist?.bio;
            return (
              <Link
                key={p.id}
                href={href}
                className="border border-paper/15 rounded-lg p-5 bg-paper/5 hover:border-gold/40 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  {p.artist?.bio_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.artist.bio_photo_url}
                      alt={p.name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-paper/15"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-paper/10 flex items-center justify-center text-paper/30 flex-shrink-0">
                      ♪
                    </div>
                  )}
                  <div>
                    <h2 className="font-display text-lg leading-tight">{p.name}</h2>
                    <p className="font-mono text-[11px] text-paper/40">
                      {[p.artist ? "Artist" : null, ...(p.connect?.roles ?? [])].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                {blurb && <p className="text-paper/70 text-sm line-clamp-2">{blurb}</p>}
                {p.connect && (p.connect.location || p.connect.remote) && (
                  <p className="font-mono text-[11px] text-paper/40">
                    {[p.connect.location, p.connect.remote ? "Works remote" : null].filter(Boolean).join(" · ")}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
