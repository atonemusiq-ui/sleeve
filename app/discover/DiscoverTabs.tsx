"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  explicit?: boolean | null;
  artists: { id: string; profiles: { display_name: string } | null } | null;
};

type Tab = "new" | "forYou" | "trending";

// The three feeds app/discover/page.tsx builds, switched between with a
// tab bar rather than three routes -- there's one shared track shape and
// one shared tile, so a tab is just picking which pre-computed list (and,
// for "new", which filters) to render.
export default function DiscoverTabs({
  recencyTracks,
  personalizedTracks,
  trendingTracks,
  hasPersonalization,
  isLoggedIn,
  startCheckout,
  blockedTrackIds,
  allGenres,
}: {
  recencyTracks: Track[];
  personalizedTracks: Track[];
  trendingTracks: Track[];
  hasPersonalization: boolean;
  isLoggedIn: boolean;
  startCheckout: (formData: FormData) => void;
  blockedTrackIds: string[];
  allGenres: string[];
}) {
  const [tab, setTab] = useState<Tab>("new");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [aiFilter, setAiFilter] = useState<"" | "human" | "ai">("");

  const blockedSet = useMemo(() => new Set(blockedTrackIds), [blockedTrackIds]);

  const filteredRecency = useMemo(() => {
    return recencyTracks.filter((t) => {
      if (genreFilter && t.genre !== genreFilter) return false;
      if (aiFilter === "human" && isAiMusic(t.ai_disclosure)) return false;
      if (aiFilter === "ai" && !isAiMusic(t.ai_disclosure)) return false;
      return true;
    });
  }, [recencyTracks, genreFilter, aiFilter]);

  // A fan with no follows and no purchase history yet has nothing to
  // personalize from -- rather than showing an empty "For You" tab, it
  // falls back to plain recency (with a note explaining why) until they
  // follow an artist or buy something.
  const forYouTracks = hasPersonalization ? personalizedTracks : recencyTracks;
  const activeTracks = tab === "new" ? filteredRecency : tab === "forYou" ? forYouTracks : trendingTracks;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton active={tab === "new"} onClick={() => setTab("new")}>
          New
        </TabButton>
        <TabButton active={tab === "forYou"} onClick={() => setTab("forYou")}>
          For You
        </TabButton>
        <TabButton active={tab === "trending"} onClick={() => setTab("trending")}>
          Trending
        </TabButton>
      </div>

      {tab === "new" && (
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            aria-label="Filter by genre"
            className="bg-paper/5 border border-paper/20 rounded px-2 py-1.5 text-paper font-mono text-xs"
          >
            <option value="">All genres</option>
            {allGenres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value as "" | "human" | "ai")}
            aria-label="Filter by AI disclosure"
            className="bg-paper/5 border border-paper/20 rounded px-2 py-1.5 text-paper font-mono text-xs"
          >
            <option value="">All tracks</option>
            <option value="human">Human-made only</option>
            <option value="ai">AI-Assisted / AI-Generated only</option>
          </select>
        </div>
      )}

      {tab === "forYou" && !isLoggedIn && (
        <p className="text-paper/50 font-mono text-sm mb-6">
          <Link href="/login" className="text-gold underline">
            Log in
          </Link>{" "}
          and follow some artists to personalize this feed. Showing the newest releases for now.
        </p>
      )}

      {tab === "forYou" && isLoggedIn && !hasPersonalization && (
        <p className="text-paper/50 font-mono text-sm mb-6">
          Follow an artist or buy a track and this feed fills in with more like it. Showing the
          newest releases for now.
        </p>
      )}

      {tab === "trending" && trendingTracks.length === 0 && (
        <p className="text-paper/50 font-mono text-sm mb-6">Nothing trending in the last 30 days yet.</p>
      )}

      <Grid tracks={activeTracks} startCheckout={startCheckout} isLoggedIn={isLoggedIn} blockedSet={blockedSet} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-sm px-4 py-2 rounded-full border ${
        active ? "border-gold bg-gold/10 text-gold" : "border-paper/20 text-paper/60 hover:bg-paper/10"
      }`}
    >
      {children}
    </button>
  );
}

function Grid({
  tracks,
  startCheckout,
  isLoggedIn,
  blockedSet,
}: {
  tracks: Track[];
  startCheckout: (formData: FormData) => void;
  isLoggedIn: boolean;
  blockedSet: Set<string>;
}) {
  if (tracks.length === 0) {
    return <p className="text-paper/50 font-mono text-sm">No tracks match this feed yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
      {tracks.map((track) => (
        <DiscoverTile
          key={track.id}
          track={track}
          startCheckout={startCheckout}
          isLoggedIn={isLoggedIn}
          blocked={blockedSet.has(track.id)}
        />
      ))}
    </div>
  );
}

function DiscoverTile({
  track,
  startCheckout,
  isLoggedIn,
  blocked,
}: {
  track: Track;
  startCheckout: (formData: FormData) => void;
  isLoggedIn: boolean;
  blocked: boolean;
}) {
  const aiBadge = aiDisclosureBadge(track.ai_disclosure);

  return (
    <div className="h-full border border-paper/15 rounded-lg p-5 bg-paper/5 flex flex-col justify-between">
      <div>
        {track.artists?.id ? (
          <Link
            href={`/artists/${track.artists.id}`}
            className="w-full aspect-square rounded bg-paper/10 overflow-hidden mb-4 block"
          >
            {track.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.cover_url} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-paper/30 text-3xl">♪</div>
            )}
          </Link>
        ) : (
          <div className="w-full aspect-square rounded bg-paper/10 overflow-hidden mb-4">
            {track.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-paper/30 text-3xl">♪</div>
            )}
          </div>
        )}
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

        {(track.genre || track.custom_tag || aiBadge || track.explicit) && (
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
            {track.explicit && (
              <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-rust/50 text-rust">
                Explicit
              </span>
            )}
          </div>
        )}

        {track.preview_url && <audio controls src={track.preview_url} className="w-full h-9 mt-3" preload="none" />}
      </div>
      <div className="flex items-center justify-between mt-6">
        {blocked ? (
          <p className="font-mono text-xs text-rust">Pending original songwriter/producer credit.</p>
        ) : (
          <>
            <span className="font-mono text-forest text-lg">${(track.price_cents / 100).toFixed(2)}</span>
            <form action={startCheckout}>
              <input type="hidden" name="trackId" value={track.id} />
              <button
                type="submit"
                className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
              >
                {isLoggedIn ? "Buy this song" : "Log in to buy"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
