import { createClient } from "@/lib/supabase/server";
import { startCheckout } from "@/app/actions/checkout";
import { tracksNeedingCoverCredit } from "@/lib/coverCompliance";
import { aiDisclosureBadge } from "@/lib/aiDisclosure";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingForm from "./BookingForm";

export default async function ArtistPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("id, bio, bio_photo_url, gallery_urls, profiles ( display_name )")
    .eq("id", params.id)
    .single();

  if (!artist) {
    notFound();
  }

  const { data: tracks } = await supabase
    .from("tracks")
    .select("id, title, price_cents, cover_url, preview_url, created_at, genre, custom_tag, ai_disclosure")
    .eq("artist_id", artist.id)
    .order("created_at", { ascending: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const artistName = (artist as any).profiles?.display_name ?? "Unknown artist";
  const galleryUrls: string[] = ((artist as any).gallery_urls ?? []).filter(Boolean);

  // Cover songs (see lib/coverCompliance.ts) can't be sold until the artist
  // has credited the original songwriter/producer as a contributor.
  const blockedTrackIds = await tracksNeedingCoverCredit(
    (tracks ?? []).map((t) => ({ id: t.id, genre: t.genre }))
  );

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="font-mono text-xs text-paper/50 hover:text-gold">
          &larr; Back to Fyby
        </Link>
        <nav className="font-mono text-xs">
          {user ? (
            <Link href="/library" className="hover:text-gold">
              My Music
            </Link>
          ) : (
            <Link href="/login" className="hover:text-gold">
              Log in
            </Link>
          )}
        </nav>
      </div>

      <header className="mt-6 mb-10 flex items-start gap-5">
        {(artist as any).bio_photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(artist as any).bio_photo_url}
            alt={artistName}
            className="w-20 h-20 rounded-full object-cover flex-shrink-0 border border-paper/15"
          />
        )}
        <div>
          <h1 className="font-display text-3xl text-gold">{artistName}</h1>
          {artist.bio && <p className="text-paper/70 mt-3 max-w-xl">{artist.bio}</p>}
        </div>
      </header>

      {galleryUrls.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {galleryUrls.map((url, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-paper/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${artistName} photo ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="ticket-divider mb-10" />

      {(!tracks || tracks.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">No tracks published yet.</p>
      )}

      {tracks && tracks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="border border-paper/15 rounded-lg p-5 bg-paper/5 flex flex-col justify-between"
            >
              <div>
                <div className="w-full aspect-square rounded bg-paper/10 overflow-hidden mb-4">
                  {track.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-paper/30 text-3xl">
                      ♪
                    </div>
                  )}
                </div>
                <h2 className="font-display text-xl">{track.title}</h2>
                {(track.genre || track.custom_tag || aiDisclosureBadge(track.ai_disclosure)) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {track.genre && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-paper/20 text-paper/50">
                        {track.genre}
                      </span>
                    )}
                    {track.custom_tag && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-paper/20 text-paper/50">
                        #{track.custom_tag}
                      </span>
                    )}
                    {aiDisclosureBadge(track.ai_disclosure) && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-gold/40 text-gold">
                        {aiDisclosureBadge(track.ai_disclosure)}
                      </span>
                    )}
                  </div>
                )}
              {track.preview_url && (
                <audio
                  controls
                  src={track.preview_url}
                  className="w-full h-9 mt-3"
                  preload="none"
                />
              )}
              </div>
              <div className="flex items-center justify-between mt-6">
                {blockedTrackIds.has(track.id) ? (
                  <p className="font-mono text-xs text-rust">
                    Pending original songwriter/producer credit — check back soon.
                  </p>
                ) : (
                  <>
                    <span className="font-mono text-forest text-lg">
                      ${(track.price_cents / 100).toFixed(2)}
                    </span>
                    <form action={startCheckout}>
                      <input type="hidden" name="trackId" value={track.id} />
                      <button
                        type="submit"
                        className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
                      >
                        {user ? "Buy" : "Log in to buy"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="ticket-divider my-10" />

      <BookingForm artistId={artist.id} />
    </main>
  );
}
