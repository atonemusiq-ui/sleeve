import { createClient } from "@/lib/supabase/server";
import { startCheckout } from "@/app/actions/checkout";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ArtistPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("id, bio, profiles ( display_name )")
    .eq("id", params.id)
    .single();

  if (!artist) {
    notFound();
  }

  const { data: tracks } = await supabase
    .from("tracks")
    .select("id, title, price_cents, cover_url, created_at")
    .eq("artist_id", artist.id)
    .order("created_at", { ascending: false });

  const artistName = (artist as any).profiles?.display_name ?? "Unknown artist";

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <Link href="/" className="font-mono text-xs text-paper/50 hover:text-gold">
        &larr; Back to Sleeve
      </Link>

      <header className="mt-6 mb-10">
        <h1 className="font-display text-3xl text-gold">{artistName}</h1>
        {artist.bio && <p className="text-paper/70 mt-3 max-w-xl">{artist.bio}</p>}
      </header>

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
              </div>
              <div className="flex items-center justify-between mt-6">
                <span className="font-mono text-forest text-lg">
                  ${(track.price_cents / 100).toFixed(2)}
                </span>
                <form action={startCheckout}>
                  <input type="hidden" name="trackId" value={track.id} />
                  <button
                    type="submit"
                    className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
                  >
                    Buy
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
