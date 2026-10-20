"use client";

import { useMemo, useState } from "react";
import TrackAudio from "@/app/TrackAudio";
import Link from "next/link";
import { aiDisclosureBadge, isAiMusic, type AiDisclosureLevel } from "@/lib/aiDisclosure";
import { verificationBadgeLabel } from "@/lib/verification";
import { formatReleaseDate, isPreorder } from "@/lib/preorder";
import { useLang, useT } from "./I18nProvider";
import { dateLocale } from "@/lib/i18n/config";

type Track = {
  id: string;
  title: string;
  price_cents: number;
  cover_url: string | null;
  preview_url: string | null;
  genre: string | null;
  subgenre: string | null;
  custom_tag: string | null;
  ai_disclosure: AiDisclosureLevel;
  // Optional because not every caller's select() includes it (e.g. embed
  // pages that don't need it) — treated as "none" wherever it's absent.
  verification_status?: string | null;
  // Self-declared at upload (UploadForm.tsx) — shown as a plain badge so a
  // listener knows before they hit play, not gated behind anything else.
  explicit?: boolean | null;
  // Pre-order release date (lib/preorder.ts); absent/null = already out.
  release_at?: string | null;
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
  allGenres,
  hideAiRow,
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
  // Fixed list from lib/genres.ts plus any admin-approved suggestion (see
  // app/actions/genres.ts) — determines row order/presence the same way the
  // fixed list alone used to.
  allGenres: string[];
  // Set by app/ai-music/page.tsx, whose `tracks` are already scoped to
  // ai_disclosure = 'ai_generated' — the standing "AI Music" row below would
  // just be a word-for-word duplicate of "New Releases" on that page, so it
  // skips rendering it entirely rather than showing the same tracks twice.
  hideAiRow?: boolean;
}) {
  const t = useT();
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

  // Rows follow the fixed genre order from lib/genres.ts, admin-approved
  // suggestions appended after (rather than alphabetical) so the browse
  // order is deliberate — only genres that actually have a track get a row.
  const genreRows = useMemo(() => {
    if (q) return [];
    return allGenres
      .map((genre) => ({
        genre,
        tracks: tracks.filter((t) => t.genre === genre),
      }))
      .filter((row) => row.tracks.length > 0);
  }, [tracks, q, allGenres]);

  // Genre is optional on a track — an artist can leave it unset — so a
  // "New Releases" row covering every track (already sorted newest-first by
  // the query in app/page.tsx) guarantees nothing is only reachable through
  // search just because it was never tagged with a genre.
  const newReleases = q ? [] : tracks;

  // Pulls in regardless of genre — an "AI-Assisted" or "Fully AI-Generated"
  // track shows up here even if it's already in one of the rows above.
  const aiMusicTracks = useMemo(() => {
    if (q || hideAiRow) return [];
    return tracks.filter((t) => isAiMusic(t.ai_disclosure));
  }, [tracks, q, hideAiRow]);

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
        placeholder={t("store.search")}
        aria-label={t("store.search")}
        className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono text-sm mb-8"
      />

      {searchResults ? (
        searchResults.length === 0 ? (
          <p className="text-paper/50 font-mono text-sm">{t("store.noMatch", { query })}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {searchResults.map((track) => (
              <TrackTile key={track.id} track={track} {...tileProps} />
            ))}
          </div>
        )
      ) : tracks.length === 0 ? (
        <p className="text-paper/50 font-mono text-sm">{t("store.noTracks")}</p>
      ) : (
        <div>
          {newReleases.length > 0 && (
            <GenreRow title={t("store.newReleases")} tracks={newReleases} {...tileProps} />
          )}
          {aiMusicTracks.length > 0 && (
            <GenreRow title={t("store.aiMusic")} tracks={aiMusicTracks} {...tileProps} />
          )}
          {genreRows.map((row) => (
            <GenreRow
              key={row.genre}
              title={row.genre}
              tracks={row.tracks}
              showSubgenreTabs
              {...tileProps}
            />
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

function GenreRow({
  title,
  tracks,
  showSubgenreTabs,
  ...tileProps
}: { title: string; tracks: Track[]; showSubgenreTabs?: boolean } & TileProps) {
  const t = useT();
  const [activeSubgenre, setActiveSubgenre] = useState<string | null>(null);

  // Only offered when the row's own tracks actually carry subgenres (e.g. a
  // Rock row with some Classic Rock/Alternative tagged) — a plain genre row
  // with none just renders the same as before.
  const subgenres = useMemo(() => {
    if (!showSubgenreTabs) return [];
    return Array.from(new Set(tracks.map((t) => t.subgenre).filter((sg): sg is string => Boolean(sg))));
  }, [tracks, showSubgenreTabs]);

  const visibleTracks = activeSubgenre ? tracks.filter((t) => t.subgenre === activeSubgenre) : tracks;

  return (
    <div className="mb-10">
      <h2 className="font-display text-xl mb-3">{title}</h2>

      {subgenres.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => setActiveSubgenre(null)}
            className={`font-mono text-xs px-3 py-1 rounded-full border ${
              activeSubgenre === null
                ? "border-gold bg-gold/10 text-gold"
                : "border-paper/20 text-paper/60 hover:bg-paper/10"
            }`}
          >
            {t("store.all")}
          </button>
          {subgenres.map((sg) => (
            <button
              key={sg}
              type="button"
              onClick={() => setActiveSubgenre(sg)}
              className={`font-mono text-xs px-3 py-1 rounded-full border ${
                activeSubgenre === sg
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-paper/20 text-paper/60 hover:bg-paper/10"
              }`}
            >
              {sg}
            </button>
          ))}
        </div>
      )}

      <div className="scroll-row flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-6 px-6 sm:mx-0 sm:px-0">
        {visibleTracks.map((track) => (
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
  const t = useT();
  const lang = useLang();
  const album = albumByTrackId[track.id];
  const albumTrackCount = album ? albumTrackCounts[album.id] ?? 0 : 0;
  const trackBlocked = blockedSet.has(track.id);
  const albumBlocked = album ? blockedAlbumIds.has(album.id) : false;
  const aiBadge = aiDisclosureBadge(track.ai_disclosure) ? t(`badges.${track.ai_disclosure}`) : null;
  const verifiedBadge = verificationBadgeLabel(track.verification_status) ? t("badges.verified") : null;

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
        {isPreorder(track.release_at) && (
          <p className="font-mono text-xs text-flame mt-1">
            {t("store.preorderOut", { date: formatReleaseDate(track.release_at as string, dateLocale(lang)) })}
          </p>
        )}
        {track.artists?.id ? (
          <Link
            href={`/artists/${track.artists.id}`}
            className="text-paper/60 text-sm mt-1 hover:text-gold inline-block"
          >
            {track.artists.profiles?.display_name ?? t("store.unknownArtist")}
          </Link>
        ) : (
          <p className="text-paper/60 text-sm mt-1">{t("store.unknownArtist")}</p>
        )}

        {(track.genre || track.custom_tag || aiBadge || verifiedBadge || track.explicit) && (
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
            {verifiedBadge && (
              <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-forest/50 bg-forest/10 text-forest">
                ✓ {verifiedBadge}
              </span>
            )}
            {track.explicit && (
              <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-rust/50 text-rust">
                {t("badges.explicit")}
              </span>
            )}
          </div>
        )}

        <TrackAudio trackId={track.id} previewUrl={track.preview_url} releaseAt={(track as any).release_at ?? null} />
        {album && (
          <p className="font-mono text-xs text-paper/50 mt-2">
            {t(albumTrackCount === 1 ? "store.partOfAlbumOne" : "store.partOfAlbumOther", {
              title: album.title,
              count: albumTrackCount,
            })}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 mt-6">
        {trackBlocked ? (
          <p className="font-mono text-xs text-rust">
            {t("store.coverPending")}
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
                {isPreorder(track.release_at)
                  ? isLoggedIn
                    ? t("store.preorder")
                    : t("store.logInToPreorder")
                  : isLoggedIn
                  ? t("store.buySong")
                  : t("store.logInToBuy")}
              </button>
            </form>
          </div>
        )}
        {album &&
          (albumBlocked ? (
            <p className="font-mono text-xs text-rust border-t border-paper/10 pt-2">
              {t("store.albumPending")}
            </p>
          ) : (
            <div className="flex items-center justify-between border-t border-paper/10 pt-2">
              <span className="font-mono text-forest text-sm">
                {t("store.album", { price: `$${(album.price_cents / 100).toFixed(2)}` })}
              </span>
              <form action={startAlbumCheckout}>
                <input type="hidden" name="albumId" value={album.id} />
                <button
                  type="submit"
                  className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90"
                >
                  {isLoggedIn ? t("store.buyAlbum") : t("store.logInToBuy")}
                </button>
              </form>
            </div>
          ))}
      </div>
    </div>
  );
}
