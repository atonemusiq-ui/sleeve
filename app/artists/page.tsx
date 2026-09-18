import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// Public artist directory — every artist who has signed up, whether they've
// released a track yet or not. Deliberately not gated behind login: both the
// `artists` and `profiles` tables already carry "publicly readable" RLS
// policies in supabase/schema.sql (needed for the individual artist pages at
// app/artists/[id]/page.tsx to work for logged-out visitors), so this page
// just reads the same tables at the list level instead of by id.
export default async function ArtistsIndexPage() {
  const supabase = createClient();

  const { data: artists, error } = await supabase
    .from("artists")
    .select(
      "id, bio, bio_photo_url, created_at, profiles ( display_name ), tracks ( id, title, preview_url, created_at )"
    )
    .order("created_at", { ascending: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const normalizedArtists = (artists ?? []).map((artist: any) => {
    const tracks = Array.isArray(artist.tracks) ? artist.tracks : [];
    // Sample the most recently released track that actually has a preview
    // clip — preview_url is the same public, no-purchase-required 15-second
    // clip already used on the storefront (see app/FeaturedTracks.tsx),
    // never the full paid audio. Embedded relations don't come pre-sorted,
    // so this sorts client-side rather than assuming an order from Supabase.
    const sampleTrack = [...tracks]
      .filter((t) => t.preview_url)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      ...artist,
      profiles: Array.isArray(artist.profiles) ? artist.profiles[0] ?? null : artist.profiles,
      trackCount: tracks.length,
      sampleTrack,
    };
  });

  return (
    <main className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 py-12">
      <header className="flex items-center justify-between mb-12">
        <Link href="/" className="font-mono text-xs text-paper/50 hover:text-gold">
          &larr; Back to Fyby
        </Link>
        <nav className="font-mono text-sm">
          {user ? (
            <Link href="/library" className="hover:text-gold">
              My Music
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

      <h1 className="font-display text-3xl text-gold mb-2">Artists on Fyby</h1>
      <p className="font-mono text-xs text-paper/50 mb-10 max-w-xl">
        Every artist who has signed up to sell their music directly to fans — including new
        artists still putting their first release together. Hit play to sample a track right
        here, or open an artist&apos;s page to hear everything they&apos;ve got.
      </p>

      {error && (
        <p className="text-rust font-mono text-sm">Couldn&apos;t load artists: {error.message}</p>
      )}

      {!error && normalizedArtists.length === 0 && (
        <p className="text-paper/50 font-mono text-sm">No artists have signed up yet.</p>
      )}

      {!error && normalizedArtists.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {normalizedArtists.map((artist) => {
            const artistName = artist.profiles?.display_name ?? "Unknown artist";
            return (
              <div
                key={artist.id}
                className="border border-paper/15 rounded-lg p-5 bg-paper/5 hover:border-gold/40 flex flex-col gap-3"
              >
                <Link href={`/artists/${artist.id}`} className="flex items-center gap-3">
                  {artist.bio_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={artist.bio_photo_url}
                      alt={artistName}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-paper/15"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-paper/10 flex items-center justify-center text-paper/30 flex-shrink-0">
                      ♪
                    </div>
                  )}
                  <div>
                    <h2 className="font-display text-lg leading-tight">{artistName}</h2>
                    <p className="font-mono text-[11px] text-paper/40">
                      {artist.trackCount > 0
                        ? `${artist.trackCount} track${artist.trackCount === 1 ? "" : "s"}`
                        : "No tracks yet"}
                    </p>
                  </div>
                </Link>

                {artist.bio && (
                  <Link href={`/artists/${artist.id}`}>
                    <p className="text-paper/70 text-sm line-clamp-2">{artist.bio}</p>
                  </Link>
                )}

                {artist.sampleTrack ? (
                  <div className="mt-1">
                    <p className="font-mono text-[11px] text-paper/40 mb-1 truncate">
                      Sample: {artist.sampleTrack.title}
                    </p>
                    <audio
                      controls
                      src={artist.sampleTrack.preview_url}
                      className="w-full h-9"
                      preload="none"
                    />
                  </div>
                ) : (
                  artist.trackCount === 0 && (
                    <p className="font-mono text-[11px] text-paper/30 italic">
                      Check back once they release their first track.
                    </p>
                  )
                )}

                <Link
                  href={`/artists/${artist.id}`}
                  className="font-mono text-xs text-gold hover:underline mt-auto pt-1"
                >
                  {artist.trackCount > 0 ? "View full catalog →" : "View artist page →"}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
