"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GENRES } from "@/lib/genres";
import { aiDisclosureBadge, isAiMusic, type AiDisclosureLevel } from "@/lib/aiDisclosure";

type Track = {
  id: string;
  title: string;
  price_cents: number;
  cover_url: string | null;
  preview_url: string | null;
  genre: string | null;
  custom_tag: string | null;
  ai_disclosure: AiDisclosureLevel;
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
  blockedTrackIds,
}: {
  tracks: Track[];
  startCheckout: (formData: FormData) => void;
  startAlbumCheckout: (formData: FormData) => void;
  isLoggedIn: boolean;
  albumByTrackId: Record<string, AlbumRef>;
  albumTrackCounts: Record<string, number>;
  // Cover songs pending the original songwriter/producer credit (see
  // lib/coverCompliance.ts) — never who the contributor is, just which
  // track ids aren't sellable yet.
  blockedTrackIds: string[];
}) {
  const [query, setQuery] = useState("");

  const blockedSet = useMemo(() => new Set(blockedTrackIds), [blockedTrackIds]);

  // An album is blocked as a bundle if any one of its tracks is a
  // not-yet-credited cover — one bad track shouldn't let the rest of the
  // album sell around it.
  const blockedAlbumIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tracks) {
      const album = albumByTrackId[t.id];
      if (album && blockedSet.has(t.id)) ids.add(album.id);
    }
    return ids;
  }, [tracks, albumByTrackId, blockedSet]);

  const q = query.trim().toLowerCase();

  // Searching flattens everything into one results grid — browsing (no
  // query) instead groups tracks into horizontally scrolling rows, one per
  // genre plus a standing "AI Music" row, closer to a browse screen than one
  // long list.
  const searchResults = useMemo(() => {
    if (!q) return null;
    return tracks.filter((track) => {
      const artistName = track.artists?.profiles?.display_name ?? "";
      return track.title.toLowerCase().includes(q) || artistName.toLowerCase().includes(q);
    });
  }, [tracks, q]);

  // Rows follow the fixed genre order from lib/genres.ts (rather than
  // alphabetical) so the browse order is deliberate — only genres that
  // actually have a track get a row.
  const genreRows = useMemo(() => {
    if (q) return [];
    return GENRES.map((genre) => ({
      genre,
      tracks: tracks.filter((t) => t.genre === genre),
    })).filter((row) => row.tracks.length > 0);
  }, [tracks, q]);

  // Genre is optional on a track — an artist can leave it unset — so a
  // "New Releases" row covering every track (already sorted newest-first by
  // the query in app/page.tsx) guarantees nothing is only reachable through
  // search just because it was never tagged with a genre.
  const newReleases = q ? [] : tracks;

  // Pulls in regardless of genre — an "AI-Assisted" or "Fully AI-Generated"
  // track shows up here even if it's already in one of the rows above.
  const aiMusicTracks = useMemo(() => {
    if (q) return [];
    return tracks.filter((t) => isAiMusic(t.ai_disclosure));
  }, [tracks, q]);

  const tileProps = {
    startCheckout,
    startAlbumCheckout,
    isLoggedIn,
    albumByTrackId,
    albumTrackCounts,
    blockedSet,
    blockedAlbumIds,
  };

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

      {searchResults ? (
        searchResults.length === 0 ? (
          <p className="text-paper/50 font-mono text-sm">No tracks match &quot;{query}&quot;.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {searchResults.map((track) => (
              <TrackTile key={track.id} track={track} {...tileProps} />
            ))}
          </div>
        )
      ) : tracks.length === 0 ? (
        <p className="text-paper/50 font-mono text-sm">No tracks published yet.</p>
      ) : (
        <div>
          {newReleases.length > 0 && (
            <GenreRow title="New Releases" tracks={newReleases} {...tileProps} />
          )}
          {aiMusicTracks.length > 0 && (
            <GenreRow title="AI Music" tracks={aiMusicTracks} {...tileProps} />
          )}
          {genreRows.map((row) => (
            <GenreRow key={row.genre} title={row.genre} tracks={row.tracks} {...tileProps} />
          ))}
        </div>
      )}
    </div>
  );
}

type TileProps = {
  startCheckout: (formData: FormData) => void;
  startAlbumCheckout: (formData: FormData) => void;
  isLoggedIn: boolean;
  albumByTrackId: Record<string, AlbumRef>;
  albumTrackCounts: Record<string, number>;
  blockedSet: Set<string>;
  blockedAlbumIds: Set<string>;
};

function GenreRow({ title, tracks, ...tileProps }: { title: string; tracks: Track[] } & TileProps) {
  return (
    <div className="mb-10">
      <h2 className="font-display text-xl mb-3">{title}</h2>
      <div className="scroll-row flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-6 px-6 sm:mx-0 sm:px-0">
        {tracks.map((track) => (
          <div key={track.id} className="snap-start shrink-0 w-64">
            <TrackTile track={track} {...tileProps} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackTile({
  track,
  startCheckout,
  startAlbumCheckout,
  isLoggedIn,
  albumByTrackId,
  albumTrackCounts,
  blockedSet,
  blockedAlbumIds,
}: { track: Track } & TileProps) {
  const album = albumByTrackId[track.id];
  const albumTrackCount = album ? albumTrackCounts[album.id] ?? 0 : 0;
  const trackBlocked = blockedSet.has(track.id);
  const albumBlocked = album ? blockedAlbumIds.has(album.id) : false;
  const aiBadge = aiDisclosureBadge(track.ai_disclosure);

  return (
    <div className="h-full border border-paper/15 rounded-lg p-5 bg-paper/5 flex flex-col justify-between">
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
        <h3 className="font-display text-xl">{track.title}</h3>
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

        {(track.genre || track.custom_tag || aiBadge) && (
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
            {aiBadge && (
              <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-gold/40 text-gold">
                {aiBadge}
              </span>
            )}
          </div>
        )}

        {track.preview_url && (
          <audio controls src={track.preview_url} className="w-full h-9 mt-3" preload="none" />
        )}
        {album && (
          <p className="font-mono text-xs text-paper/50 mt-2">
            Part of the album <span className="text-paper/70">{album.title}</span> (
            {albumTrackCount} track{albumTrackCount === 1 ? "" : "s"})
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 mt-6">
        {trackBlocked ? (
          <p className="font-mono text-xs text-rust">
            This cover is pending the original songwriter/producer credit — check back soon.
          </p>
        ) : (
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
        )}
        {album &&
          (albumBlocked ? (
            <p className="font-mono text-xs text-rust border-t border-paper/10 pt-2">
              Full album pending a songwriter/producer credit on one of its covers.
            </p>
          ) : (
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
          ))}
      </div>
    </div>
  );
}
