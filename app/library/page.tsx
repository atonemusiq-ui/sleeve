import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { redirect } from "next/navigation";
import Link from "next/link";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function LibraryPage() {
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
      "id, created_at, tracks ( id, title, audio_path, audio_url, cover_url, artists ( id, profiles ( display_name ) ) )"
    )
    .eq("status", "complete")
    .order("created_at", { ascending: false });

  // Ownership above is already verified by RLS, so it's safe to mint signed
  // URLs with the service-role client here rather than needing a separate
  // storage policy for buyers (who aren't the artist and shouldn't get a
  // blanket read policy on "track-audio").
  const supabaseAdmin = createServiceRoleClient();
  const tracks = await Promise.all(
    (purchases ?? [])
      .filter((p) => p.tracks)
      .map(async (purchase) => {
        const track = purchase.tracks as any;
        let playUrl: string | null = null;
        if (track.audio_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("track-audio")
            .createSignedUrl(track.audio_path, SIGNED_URL_TTL_SECONDS, { download: true });
          playUrl = signed?.signedUrl ?? null;
        } else if (track.audio_url) {
          playUrl = track.audio_url;
        }
        return { purchaseId: purchase.id, track, playUrl };
      })
  );

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <h1 className="font-display text-3xl text-gold">My Music</h1>
        <Link href="/" className="font-mono text-sm hover:text-gold">
          Back to Sleeve
        </Link>
      </header>

      <div className="ticket-divider mb-10" />

      {error && (
        <p className="text-rust font-mono text-sm">
          Couldn&apos;t load your purchases: {error.message}
        </p>
      )}

      {!error && tracks.length === 0 && (
        <p className="text-paper/50 font-mono text-sm">
          Nothing here yet — tracks you buy will show up on this page, ready to play anytime.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {tracks.map(({ purchaseId, track, playUrl }) => (
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
            {playUrl ? (
              <audio controls src={playUrl} className="w-full h-10" />
            ) : (
              <p className="font-mono text-xs text-rust">
                No audio file found for this track — contact the artist.
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
