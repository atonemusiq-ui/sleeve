import Link from "next/link";

// Shown only to logged-out visitors, right up top after the hero (see
// app/page.tsx) — real tracks actually for sale on Fyby today, not a mockup.
// Deliberately framed as a hand-picked "hear it for yourself" moment rather
// than a scale claim (an artist/track counter would look sparse this early
// on) — a few real, playable songs do more to build trust than any number
// would. Pulls from the same `tracks` query app/page.tsx already runs, so
// there's no extra database round trip.
type FeaturedTrack = {
  id: string;
  title: string;
  price_cents: number;
  cover_url: string | null;
  preview_url: string | null;
  artists: {
    id: string;
    profiles: { display_name: string } | null;
  } | null;
};

export default function FeaturedTracks({
  tracks,
  startCheckout,
  isLoggedIn,
}: {
  tracks: FeaturedTrack[];
  startCheckout: (formData: FormData) => void;
  isLoggedIn: boolean;
}) {
  if (tracks.length === 0) return null;

  return (
    <section className="mb-16">
      <h2 className="font-display text-2xl mb-1">Hear it for yourself</h2>
      <p className="text-paper/50 font-mono text-xs mb-6">Real tracks, on sale right now — no sample loops, no mockups.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {tracks.map((track) => (
          <div
            key={track.id}
            className="border border-paper/15 rounded-lg p-4 bg-paper/5 flex flex-col gap-3"
          >
            <div className="w-full aspect-square rounded bg-paper/10 overflow-hidden">
              {track.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-paper/30 text-3xl">
                  ♪
                </div>
              )}
            </div>
            <div>
              <h3 className="font-display text-lg leading-tight">{track.title}</h3>
              {track.artists?.id ? (
                <Link
                  href={`/artists/${track.artists.id}`}
                  className="text-paper/60 text-sm hover:text-gold inline-block"
                >
                  {track.artists.profiles?.display_name ?? "Unknown artist"}
                </Link>
              ) : (
                <p className="text-paper/60 text-sm">Unknown artist</p>
              )}
            </div>
            {track.preview_url && (
              <audio controls src={track.preview_url} className="w-full h-9" preload="none" />
            )}
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-forest">${(track.price_cents / 100).toFixed(2)}</span>
              <form action={startCheckout}>
                <input type="hidden" name="trackId" value={track.id} />
                <button
                  type="submit"
                  className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
                >
                  {isLoggedIn ? "Buy this song" : "Log in to buy"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
