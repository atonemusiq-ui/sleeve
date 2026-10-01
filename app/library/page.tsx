import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatReleaseDate, isPreorder } from "@/lib/preorder";
import { licenseTierLabel } from "@/lib/licensing";

export default async function LibraryPage({ searchParams }: { searchParams?: { licensed?: string } }) {
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

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <h1 className="font-display text-3xl text-gold">My Music</h1>
        <Link href="/" className="font-mono text-sm hover:text-gold">
          Back to Fyby
        </Link>
      </header>

      <div className="ticket-divider mb-10" />

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
        {tracks.map(({ purchaseId, trackId, track }) => (
          <div
            key={purchaseId}
            className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 flex flex-col gap-3"
          >
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
          </div>
        ))}
      </div>
    </main>
  );
}
