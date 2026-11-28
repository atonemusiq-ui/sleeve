import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatReleaseDate, isPreorder } from "@/lib/preorder";
import { licenseTierLabel } from "@/lib/licensing";
import WaitForPurchase from "./WaitForPurchase";
import ShareSnippetButton from "./ShareSnippetButton";
import LibraryPlayButton from "./LibraryPlayButton";
import MiniPlayer from "@/app/artists/[id]/MiniPlayer";
import { getAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const NO_GENRE = "Other";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

export default async function LibraryPage({
  searchParams,
}: {
  // bought / album / session_id are set by app/success/page.tsx right after
  // checkout, so the new purchase can be confirmed and highlighted here.
  // genre picks a folder (one genre) to show.
  searchParams?: { licensed?: string; bought?: string; album?: string; session_id?: string; genre?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/library")}`);
  }

  // RLS ("fans can read their own purchases" in supabase/schema.sql) scopes
  // this to rows where fan_id = auth.uid() — nobody else's purchases can
  // come back here, regardless of what account looked.
  const { data: purchases, error } = await supabase
    .from("purchases")
    .select(
      "id, track_id, created_at, tracks ( id, title, cover_url, release_at, genre, artists ( id, profiles ( display_name ) ) )"
    )
    .eq("status", "complete")
    .order("created_at", { ascending: false });

  // Beat & sync licenses this fan has bought (lib/licensing.ts), each with
  // its certificate. RLS scopes these to the caller's own rows.
  const { data: licenses } = await supabase
    .from("license_purchases")
    .select("id, tier, licensee_name, status, created_at, track_id, tracks ( title, cover_url )")
    .order("created_at", { ascending: false });

  const tracks = (purchases ?? [])
    .filter((p) => p.tracks)
    .map((purchase) => ({
      purchaseId: purchase.id,
      trackId: purchase.track_id,
      track: purchase.tracks as any,
    }));

  // Fyby admins (lib/admin.ts) get every newly uploaded song here to review,
  // without buying it. Read with the service-role client so frozen and
  // inactive-artist tracks show too; /api/stream lets admins play them.
  const isAdmin = Boolean(await getAdmin());
  let reviewTracks: any[] = [];
  if (isAdmin) {
    const service = createServiceRoleClient();
    const { data } = await service
      .from("tracks")
      .select("id, title, cover_url, created_at, frozen, artists ( id, profiles ( display_name ) )")
      .order("created_at", { ascending: false })
      .limit(50);
    reviewTracks = data ?? [];
  }

  // Just came from checkout: which songs were bought, and are they saved yet?
  let justBoughtIds: string[] = [];
  if (searchParams?.bought) {
    justBoughtIds = [searchParams.bought];
  } else if (searchParams?.album) {
    const { data: albumTracks } = await supabase
      .from("album_tracks")
      .select("track_id")
      .eq("album_id", searchParams.album);
    justBoughtIds = (albumTracks ?? []).map((r: any) => r.track_id);
  }
  const justBought = new Set(justBoughtIds);
  const justBoughtSaved = justBoughtIds.length > 0 && tracks.some((t) => justBought.has(t.trackId));
  const justBoughtTitles = tracks.filter((t) => justBought.has(t.trackId)).map((t) => t.track?.title ?? "your song");

  // Genre folders: every genre in the fan's library, with a count.
  const genreOf = (t: { track: any }) => (t.track?.genre as string | null) || NO_GENRE;
  const folderCounts = new Map<string, number>();
  for (const t of tracks) folderCounts.set(genreOf(t), (folderCounts.get(genreOf(t)) ?? 0) + 1);
  const folders = Array.from(folderCounts.entries()).sort((a, b) =>
    a[0] === NO_GENRE ? 1 : b[0] === NO_GENRE ? -1 : a[0].localeCompare(b[0])
  );
  const activeGenre = searchParams?.genre && folderCounts.has(searchParams.genre) ? searchParams.genre : null;

  // Newly bought songs first, then everything else newest-first.
  const orderedTracks = [
    ...tracks.filter((t) => justBought.has(t.trackId)),
    ...tracks.filter((t) => !justBought.has(t.trackId)),
  ].filter((t) => !activeGenre || genreOf(t) === activeGenre);

  const receiptHref = searchParams?.session_id
    ? `/success?session_id=${encodeURIComponent(searchParams.session_id)}&receipt=1`
    : null;

  const chip = (active: boolean) =>
    `flex-shrink-0 font-mono text-xs px-3 py-1.5 rounded-full border transition-colors ${
      active ? "border-gold bg-gold text-ink" : "border-paper/20 text-paper/70 hover:border-gold hover:text-gold"
    }`;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-28">
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl sm:text-4xl text-paper">My Music</h1>
        <Link href="/" className="font-mono text-xs text-paper/60 hover:text-gold">
          Back to Fyby
        </Link>
      </header>

      {justBoughtIds.length > 0 &&
        (justBoughtSaved ? (
          <div
            role="status"
            className="mb-6 rounded-lg border border-forest/40 bg-forest/10 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-display text-lg text-forest">✓ Thank you! It&apos;s in your library</p>
              <p className="font-mono text-xs text-paper/70 mt-1">
                <span className="text-paper">
                  {justBoughtTitles.length === 1 ? `“${justBoughtTitles[0]}”` : `${justBoughtTitles.length} songs`}
                </span>{" "}
                {justBoughtTitles.length === 1 ? "is" : "are"} ready to play below, in full, anytime. The artist gets paid directly.
              </p>
            </div>
            {receiptHref && (
              <Link href={receiptHref} className="font-mono text-xs text-gold hover:underline flex-shrink-0">
                Share it / receipt
              </Link>
            )}
          </div>
        ) : (
          <div role="status" className="mb-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
            <WaitForPurchase />
            <p className="font-display text-lg text-gold">Adding your song to your library…</p>
            <p className="font-mono text-xs text-paper/60 mt-1">
              Your payment went through. This takes a few seconds — the page will update on its own.
            </p>
          </div>
        ))}

      {searchParams?.licensed && (
        <p className="font-mono text-sm text-forest border border-forest/40 bg-forest/10 rounded px-4 py-3 mb-6">
          Payment received — your license is being finalized and will appear under My Licenses in a few seconds.
          Refresh if you don&apos;t see it yet.
        </p>
      )}

      {/* Genre folders */}
      {folders.length > 0 && (
        <nav aria-label="Genre folders" className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          <Link href="/library" className={chip(!activeGenre)}>
            All songs · {tracks.length}
          </Link>
          {folders.map(([g, n]) => (
            <Link key={g} href={`/library?genre=${encodeURIComponent(g)}`} className={chip(activeGenre === g)}>
              📁 {g} · {n}
            </Link>
          ))}
        </nav>
      )}

      {error && <p className="text-rust font-mono text-sm">Couldn&apos;t load your purchases: {error.message}</p>}

      {!error && tracks.length === 0 && (licenses ?? []).length === 0 && (
        <p className="text-paper/50 font-mono text-sm">
          Nothing here yet — tracks you buy will show up on this page, ready to play anytime.
        </p>
      )}

      {/* Songs: compact rows, like a music app's library list. */}
      {orderedTracks.length > 0 && (
        <section aria-label={activeGenre ? `${activeGenre} songs` : "Songs"}>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="font-display text-xl">{activeGenre ?? "Songs"}</h2>
            <span className="font-mono text-[11px] text-paper/50">
              {orderedTracks.length} {orderedTracks.length === 1 ? "song" : "songs"}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-paper/[0.08]">
            {orderedTracks.map(({ purchaseId, trackId, track }) => {
              const artistName = one<any>(track.artists?.profiles)?.display_name ?? track.artists?.profiles?.display_name ?? "Unknown artist";
              const preorder = isPreorder(track.release_at);
              const isNew = justBought.has(trackId);
              return (
                <li
                  key={purchaseId}
                  className={`group flex items-center gap-3 px-2 py-2 rounded-md hover:bg-paper/[0.06] ${
                    isNew ? "bg-forest/10 ring-1 ring-forest/40" : ""
                  }`}
                >
                  <div className="relative w-10 h-10 rounded bg-paper/10 flex-shrink-0 overflow-hidden">
                    {track.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-paper/30 text-xs">♪</div>
                    )}
                    {/* Plays through the protected stream route, which re-checks
                        ownership on every request and mints its own short-lived
                        URL, so the page never holds a raw file link. */}
                    {!preorder && <LibraryPlayButton trackId={trackId} title={track.title} artistName={artistName} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-paper truncate">
                      {track.title}
                      {isNew && (
                        <span className="ml-2 rounded-full bg-forest/20 px-2 py-0.5 font-mono text-[10px] text-forest align-middle">
                          Just added
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] text-paper/55 truncate">
                      {track.artists?.id ? (
                        <Link href={`/artists/${track.artists.id}`} className="hover:text-gold">
                          {artistName}
                        </Link>
                      ) : (
                        artistName
                      )}
                      {track.genre && !activeGenre ? ` · ${track.genre}` : ""}
                      {preorder && (
                        <span className="text-flame"> · Pre-ordered, unlocks {formatReleaseDate(track.release_at)}</span>
                      )}
                    </p>
                  </div>

                  {!preorder && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <ShareSnippetButton
                        trackId={trackId}
                        title={track.title}
                        artistName={artistName}
                        fanId={user!.id}
                      />
                      {/* Same protected route as the player: it re-checks the
                          purchase and hands back a short-lived download URL. */}
                      <a
                        href={`/api/stream/${trackId}`}
                        download
                        aria-label={`Download ${track.title}`}
                        title="Download"
                        className="w-9 h-9 rounded-full flex items-center justify-center text-paper/60 hover:text-gold hover:bg-paper/10"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 4v11" />
                          <path d="M7 10l5 5 5-5" />
                          <path d="M5 20h14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(licenses ?? []).length > 0 && !activeGenre && (
        <section className="mt-10">
          <h2 className="font-display text-xl mb-2">My Licenses</h2>
          <ul className="flex flex-col divide-y divide-paper/[0.08]">
            {(licenses ?? []).map((license: any) => (
              <li key={license.id} className="flex items-center gap-3 px-2 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate">{license.tracks?.title ?? "Untitled"}</p>
                  <p className="font-mono text-[11px] text-paper/55 truncate">
                    {licenseTierLabel(license.tier)} · for {license.licensee_name}
                    {license.status !== "complete" && <span className="text-rust"> · {license.status}</span>}
                  </p>
                </div>
                <Link
                  href={`/licenses/${license.id}`}
                  className="font-mono text-[11px] px-2.5 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
                >
                  Certificate
                </Link>
                {license.status === "complete" && (
                  <a
                    href={`/api/stream/${license.track_id}`}
                    download
                    className="font-mono text-[11px] px-2.5 py-1.5 rounded border border-paper/30 text-paper/80 hover:bg-paper/10"
                  >
                    Download
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Admins: every newly uploaded song, playable in full, to review.
          Collapsed by default so it doesn't push the fan's own music down. */}
      {reviewTracks.length > 0 && (
        <details className="mt-10 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3">
          <summary className="cursor-pointer font-display text-lg">
            Review new uploads <span className="font-mono text-xs text-paper/50">· admin only · {reviewTracks.length}</span>
          </summary>
          <p className="font-mono text-[11px] text-paper/50 mt-2 mb-2">
            The newest songs uploaded to Fyby, so you can check them. Use the Admin moderation page to flag or freeze one.
          </p>
          <ul className="flex flex-col divide-y divide-paper/[0.08]">
            {reviewTracks.map((t: any) => {
              const artist = one<any>(t.artists);
              const profile = one<any>(artist?.profiles);
              const name = profile?.display_name ?? "Unknown artist";
              return (
                <li key={t.id} className="group flex items-center gap-3 px-1 py-2">
                  <div className="relative w-10 h-10 rounded bg-paper/10 flex-shrink-0 overflow-hidden">
                    {t.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-paper/30 text-xs">♪</div>
                    )}
                    <LibraryPlayButton trackId={t.id} title={t.title} artistName={name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate">{t.title}</p>
                    <p className="font-mono text-[11px] text-paper/55 truncate">
                      {name} · uploaded {new Date(t.created_at).toLocaleDateString("en-US")}
                      {t.frozen && <span className="text-rust"> · frozen</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <MiniPlayer />
    </main>
  );
}
