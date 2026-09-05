"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Track = {
  id: string;
  title: string;
  price_cents: number;
  cover_url: string | null;
  preview_url: string | null;
  genre: string | null;
  custom_tag: string | null;
  ai_disclosure: boolean;
  artists: {
    id: string;
    profiles: { display_name: string } | null;
  } | null;
};

type AlbumRef = { id: string; title: string; price_cents: number };

export default function StorefrontGrid({
  tracks,
  startCheckout,
  startAlbumCheckout,
  isLoggedIn,
  albumByTrackId,
  albumTrackCounts,
}: {
  tracks: Track[];
  startCheckout: (formData: FormData) => void;
  startAlbumCheckout: (formData: FormData) => void;
  isLoggedIn: boolean;
  albumByTrackId: Record<string, AlbumRef>;
  albumTrackCounts: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");

  // Only genres that actually have a track get a pill — an artist not
  // picking a genre at all just means that track only ever shows under
  // "All", it never grows an empty filter option.
  const genres = useMemo(() => {
    const present = new Set<string>();
    for (const t of tracks) {
      if (t.genre) present.add(t.genre);
    }
    return ["All", ...Array.from(present).sort()];
  }, [tracks]);

  const q = query.trim().toLowerCase();
  const filtered = tracks.filter((track) => {
    if (selectedGenre !== "All" && track.genre !== selectedGenre) return false;
    if (!q) return true;
    const artistName = track.artists?.profiles?.display_name ?? "";
    return track.title.toLowerCase().includes(q) || artistName.toLowerCase().includes(q);
  });

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tracks or artists..."
        aria-label="Search tracks or artists"
        className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono text-sm mb-4"
      />

      {genres.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`font-mono text-xs px-3 py-1.5 rounded-full border ${
                selectedGenre === g
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-paper/20 text-paper/60 hover:bg-paper/10"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-paper/50 font-mono text-sm">
          {q ? <>No tracks match &quot;{query}&quot;.</> : <>No tracks in this genre yet.</>}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filtered.map((track) => {
            const album = albumByTrackId[track.id];
            const albumTrackCount = album ? albumTrackCounts[album.id] ?? 0 : 0;

            return (
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
                  {track.artists?.id ? (
                    <Link
                      href={`/artists/${track.artists.id}`}
                      className="text-paper/60 text-sm mt-1 hover:text-gold inline-block"
                    >
                      {track.artists.profiles?.display_name ?? "Unknown artist"}
                    </Link>
                  ) : (
                    <p className="text-paper/60 text-sm mt-1">Unknown artist</p>
                  )}

                  {(track.genre || track.custom_tag || track.ai_disclosure) && (
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
                      {track.ai_disclosure && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-gold/40 text-gold">
                          AI-assisted
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
                  {album && (
                    <p className="font-mono text-xs text-paper/50 mt-2">
                      Part of the album <span className="text-paper/70">{album.title}</span> (
                      {albumTrackCount} track{albumTrackCount === 1 ? "" : "s"})
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 mt-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-forest text-lg">
                      ${(track.price_cents / 100).toFixed(2)}
                    </span>
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
                  {album && (
                    <div className="flex items-center justify-between border-t border-paper/10 pt-2">
                      <span className="font-mono text-forest text-sm">
                        Album ${(album.price_cents / 100).toFixed(2)}
                      </span>
                      <form action={startAlbumCheckout}>
                        <input type="hidden" name="albumId" value={album.id} />
                        <button
                          type="submit"
                          className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90"
                        >
                          {isLoggedIn ? "Buy full album" : "Log in to buy"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
