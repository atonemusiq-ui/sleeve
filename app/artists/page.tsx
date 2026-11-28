import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { artistCirclePhoto } from "@/lib/artistPhoto";
import ArtistsDirectory, { type DirectoryArtist } from "./ArtistsDirectory";
import MiniPlayer from "./[id]/MiniPlayer";

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
      "id, bio, bio_photo_url, gallery_urls, created_at, profiles ( display_name ), tracks ( id, title, preview_url, cover_url, frozen, created_at, genre )"
    )
    .order("created_at", { ascending: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const directory: DirectoryArtist[] = (artists ?? []).map((artist: any) => {
    const allTracks = Array.isArray(artist.tracks) ? artist.tracks : [];
    // Songs taken down (by an admin or by the artist) don't count or show.
    const tracks = allTracks.filter((t: any) => !t.frozen);
    // Sample the most recently released track that has a preview clip —
    // preview_url is the public 15-second clip, never the full paid audio.
    const sampleTrack = [...tracks]
      .filter((t: any) => t.preview_url)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    // The genre this artist releases most often, plus every genre they have.
    const counts = new Map<string, number>();
    for (const t of tracks) if (t.genre) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
    const genres = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([g]) => g);
    const profile = Array.isArray(artist.profiles) ? artist.profiles[0] ?? null : artist.profiles;

    return {
      id: artist.id,
      name: (profile?.display_name ?? "Unknown artist").trim(),
      photo: artistCirclePhoto({ ...artist, tracks }) ?? null,
      genre: genres[0] ?? null,
      genres,
      trackCount: tracks.length,
      sample: sampleTrack
        ? { id: sampleTrack.id, title: sampleTrack.title, previewUrl: sampleTrack.preview_url }
        : null,
    };
  });

  // Artists with the most songs first, then those with a photo.
  directory.sort((a, b) => b.trackCount - a.trackCount || Number(Boolean(b.photo)) - Number(Boolean(a.photo)));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-28">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="font-mono text-xs text-paper/50 hover:text-gold">
          &larr; Back to Fyby
        </Link>
        <nav className="font-mono text-xs">
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

      <div className="mb-6">
        <h1 className="font-display font-bold text-4xl sm:text-5xl text-paper leading-none">Artists</h1>
        <p className="text-sm text-paper/60 mt-2">Buy direct. Every sale pays the artist.</p>
      </div>

      {error && <p className="text-rust font-mono text-sm">Couldn&apos;t load artists: {error.message}</p>}

      {!error && directory.length === 0 && (
        <p className="text-paper/50 font-mono text-sm">No artists have signed up yet.</p>
      )}

      {!error && directory.length > 0 && <ArtistsDirectory artists={directory} />}

      <MiniPlayer />
    </main>
  );
}
