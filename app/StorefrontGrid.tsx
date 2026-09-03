"use client";

import { useState } from "react";
import Link from "next/link";

type Track = {
  id: string;
  title: string;
  price_cents: number;
  cover_url: string | null;
  artists: {
    id: string;
    profiles: { display_name: string } | null;
  } | null;
};

export default function StorefrontGrid({
  tracks,
  startCheckout,
  isLoggedIn,
}: {
  tracks: Track[];
  startCheckout: (formData: FormData) => void;
  isLoggedIn: boolean;
}) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? tracks.filter((track) => {
        const artistName = track.artists?.profiles?.display_name ?? "";
        return (
          track.title.toLowerCase().includes(q) || artistName.toLowerCase().includes(q)
        );
      })
    : tracks;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tracks or artists..."
        aria-label="Search tracks or artists"
        className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono text-sm mb-8"
      />

      {filtered.length === 0 ? (
        <p className="text-paper/50 font-mono text-sm">
          No tracks match &quot;{query}&quot;.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filtered.map((track) => (
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
                    {isLoggedIn ? "Buy" : "Log in to buy"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
