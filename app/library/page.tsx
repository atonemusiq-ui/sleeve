import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatReleaseDate, isPreorder } from "@/lib/preorder";
import { licenseTierLabel } from "@/lib/licensing";
import WaitForPurchase from "./WaitForPurchase";
import ShareSnippetButton from "./ShareSnippetButton";

export default async function LibraryPage({
  searchParams,
}: {
  // bought / album / session_id are set by app/success/page.tsx right after
  // checkout, so the new purchase can be confirmed and highlighted here.
  searchParams?: { licensed?: string; bought?: string; album?: string; session_id?: string };
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
      "id, track_id, created_at, tracks ( id, title, cover_url, release_at, artists ( id, profiles ( display_name ) ) )"
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
  // Newly bought songs first, then everything else newest-first.
  const orderedTracks = [
    ...tracks.filter((t) => justBought.has(t.trackId)),
    ...tracks.filter((t) => !justBought.has(t.trackId)),
  ];
  const receiptHref = searchParams?.session_id
    ? `/success?session_id=${encodeURIComponent(searchParams.session_id)}&receipt=1`
    : null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <h1 className="font-display text-3xl text-gold">My Music</h1>
        <Link href="/" className="font-mono text-sm hover:text-gold">
          Back to Fyby
        </Link>
      </header>

      <div className="ticket-divider mb-10" />

      {justBoughtIds.length > 0 &&
        (justBoughtSaved ? (
          <div
            role="status"
            className="mb-8 rounded-lg border border-forest/40 bg-forest/10 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-display text-lg text-forest">✓ Thank you! It&apos;s in your library</p>
              <p className="font-mono text-xs text-paper/70 mt-1">
                <span className="text-paper">{justBoughtTitles.length === 1 ? `\u201c${justBoughtTitles[0]}\u201d` : `${justBoughtTitles.length} songs`}</span>{" "}
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
          <div role="status" className="mb-8 rounded-lg border border-gold/30 bg-gold/5 px-5 py-4">
            <WaitForPurchase />
            <p className="font-display text-lg text-gold">Adding your song to your library…</p>
            <p className="font-mono text-xs text-paper/60 mt-1">
              Your payment went through. This takes a few seconds — the page will update on its own.
            </p>
          </div>
        ))}

      {searchParams?.licensed && (
        <p className="font-mono text-sm text-forest border border-forest/40 bg-forest/10 rounded px-4 py-3 mb-8">
          Payment received — your license is being finalized and will appear under My Licenses in a few
          seconds. Refresh if you don&apos;t see it yet.
        </p>
      )}

      {(licenses ?? []).length > 0 && (
        <section className="mb-12">
          <h2 className="font-display text-xl mb-4">My Licenses</h2>
          <div className="flex flex-col gap-3">
            {(licenses ?? []).map((license: any) => (
              <div
                key={license.id}
                className="border border-gold/30 rounded-lg px-5 py-4 bg-gold/5 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1">
                  <span className="font-display text-lg block">{license.tracks?.title ?? "Untitled"}</span>
                  <span className="font-mono text-xs text-paper/60">
                    {licenseTierLabel(license.tier)} · for{" "}
                    {license.licensee_name}
                    {license.status !== "complete" && <span className="text-rust"> · {license.status}</span>}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/licenses/${license.id}`}
                    className="font-mono text-xs px-3 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10"
                  >
                    Certificate
                  </Link>
                  {license.status === "complete" && (
                    <a
                      href={`/api/stream/${license.track_id}`}
                      download
                      className="font-mono text-xs px-3 py-2 rounded border border-paper/30 text-paper/80 hover:bg-paper/10"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p className="text-rust font-mono text-sm">
          Couldn&apos;t load your purchases: {error.message}
        </p>
      )}

      {!error && tracks.length === 0 && (licenses ?? []).length === 0 && (
        <p className="text-paper/50 font-mono text-sm">
          Nothing here yet — tracks you buy will show up on this page, ready to play anytime.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {orderedTracks.map(({ purchaseId, trackId, track }) => (
          <div
            key={purchaseId}
            className={`rounded-lg px-5 py-4 flex flex-col gap-3 border ${
              justBought.has(trackId) ? "border-forest/60 bg-forest/10 ring-2 ring-forest/30" : "border-paper/15 bg-paper/5"
            }`}
          >
            {justBought.has(trackId) && (
              <span className="self-start rounded-full bg-forest/20 px-2.5 py-0.5 font-mono text-[11px] text-forest">
                Just added
              </span>
            )}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded bg-paper/10 flex-shrink-0 overflow-hidden">
                {track.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-paper/30 text-xs">
                    ♪
                  </div>
                )}
              </div>
              <div className="flex-1">
                <span className="font-display text-lg block">{track.title}</span>
                {track.artists?.id && (
                  <Link
                    href={`/artists/${track.artists.id}`}
                    className="text-paper/60 text-sm hover:text-gold"
                  >
                    {track.artists.profiles?.display_name ?? "Unknown artist"}
                  </Link>
                )}
              </div>
            </div>
            {/* Points at the protected stream route rather than a signed URL
                minted here — /api/stream/[trackId] re-checks ownership on
                every request and mints its own short-lived URL, so the
                player never holds a raw or long-lived file link. */}
            {isPreorder(track.release_at) ? (
              <p className="font-mono text-xs text-flame">
                Pre-ordered — this song unlocks here on {formatReleaseDate(track.release_at)}.
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <audio controls src={`/api/stream/${trackId}`} className="w-full h-10" />
                {/* Same protected route as the player: it re-checks the
                    purchase and hands back a short-lived signed URL that's
                    already marked as a download. */}
                <a
                  href={`/api/stream/${trackId}`}
                  download
                  className="font-mono text-xs px-3 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10 flex-shrink-0"
                >
                  Download
                </a>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-paper/50">
                Send a friend a free snippet. They can buy it from the link.
              </span>
              <ShareSnippetButton
                trackId={trackId}
                title={track.title}
                artistName={track.artists?.profiles?.display_name ?? "this artist"}
                fanId={user!.id}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
