import { createClient } from "@/lib/supabase/server";
import { startCheckout } from "@/app/actions/checkout";
import Link from "next/link";

export default async function StorefrontPage() {
  const supabase = createClient();

  const { data: tracks, error } = await supabase
    .from("tracks")
    .select(
      "id, title, price_cents, created_at, audio_url, cover_url, artists ( id, bio, user_id, profiles ( display_name ) )"
    )
    .order("created_at", { ascending: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <h1 className="font-display text-3xl text-gold">Sleeve</h1>
        <nav className="font-mono text-sm">
          {user ? (
            <Link href="/dashboard" className="hover:text-gold">
              Dashboard
            </Link>
          ) : (
            <div className="flex gap-4">
              <Link href="/login" className="hover:text-gold">
                Log in
              </Link>
              <Link href="/signup" className="hover:text-gold">
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </header>

      <p className="text-paper/70 mb-10 max-w-xl">
        Buy tracks directly from independent artists. A fixed price, paid mostly to the artist —
        not a fraction of a cent per stream.
      </p>

      <div className="ticket-divider mb-10" />

      {error && (
        <p className="text-rust font-mono text-sm">Couldn&apos;t load tracks: {error.message}</p>
      )}

      {!error && (!tracks || tracks.length === 0) && (
        <p className="text-paper/50 font-mono text-sm">No tracks published yet.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {tracks?.map((track: any) => (
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
              <p className="text-paper/60 text-sm mt-1">
                {track.artists?.profiles?.display_name ?? "Unknown artist"}
              </p>
              {track.audio_url && (
                <audio controls src={track.audio_url} className="w-full h-10 mt-3" />
              )}
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
    </main>
  );
}
