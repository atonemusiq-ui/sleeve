"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// One shared player for every public track listing (storefront, AI Music,
// discover, featured, artist pages). Anyone who has bought the song — or
// licensed it — hears the full song through /api/stream/[trackId], which
// re-checks the purchase server-side; everyone else hears the 15-second
// preview clip. Before this, those listings always played the preview, so a
// buyer only got the full song on the separate Library page.

// Which track ids the signed-in listener owns, fetched once per account per
// page load and shared by every player on the page (a storefront can show
// dozens). Keyed by user id so switching accounts never shows stale results.
type Owned = { bought: Set<string>; mine: Set<string> };
const EMPTY: Owned = { bought: new Set(), mine: new Set() };
const ownedByUser = new Map<string, Promise<Owned>>();

async function loadOwnedTrackIds(): Promise<Owned> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return EMPTY;

  const cached = ownedByUser.get(userId);
  if (cached) return cached;

  const promise = (async () => {
    // RLS already limits both tables to the caller's own rows.
    const [{ data: purchases }, { data: licenses }, { data: myArtists }] = await Promise.all([
      supabase.from("purchases").select("track_id").eq("fan_id", userId).eq("status", "complete"),
      supabase.from("license_purchases").select("track_id").eq("buyer_id", userId).eq("status", "complete"),
      supabase.from("artists").select("id").eq("user_id", userId),
    ]);
    const bought = new Set<string>();
    for (const row of [...(purchases ?? []), ...(licenses ?? [])]) {
      if (row?.track_id) bought.add(row.track_id);
    }
    // An artist's own uploads play in full for them too.
    const mine = new Set<string>();
    const artistIds = (myArtists ?? []).map((a) => a.id);
    if (artistIds.length) {
      const { data: myTracks } = await supabase.from("tracks").select("id").in("artist_id", artistIds);
      for (const row of myTracks ?? []) mine.add(row.id);
    }
    return { bought, mine };
  })().catch(() => {
    // A failed lookup just falls back to previews; try again next time.
    ownedByUser.delete(userId);
    return EMPTY;
  });
  ownedByUser.set(userId, promise);
  return promise;
}

// True once we know the signed-in listener owns this track (bought or
// licensed). False while loading and for everyone else.
// "mine" = the listener is the artist who uploaded it.
export function useOwnsTrack(trackId: string): "bought" | "mine" | null {
  const [owned, setOwned] = useState<"bought" | "mine" | null>(null);
  useEffect(() => {
    let alive = true;
    loadOwnedTrackIds().then(({ bought, mine }) => {
      if (alive) setOwned(mine.has(trackId) ? "mine" : bought.has(trackId) ? "bought" : null);
    });
    return () => {
      alive = false;
    };
  }, [trackId]);
  return owned;
}

// Shows its children (price + Buy button) to people who don't own the song;
// a buyer sees "You own this" with a link to their Library instead, so a
// song they already paid for never asks them to buy it again.
export function UnlessOwned({
  trackId,
  releaseAt = null,
  children,
}: {
  trackId: string;
  releaseAt?: string | null;
  children: ReactNode;
}) {
  const owned = useOwnsTrack(trackId);
  if (!owned) return <>{children}</>;
  if (owned === "mine") {
    return (
      <div className="flex items-center justify-between gap-3 w-full">
        <span className="font-mono text-xs text-gold">★ Your song</span>
        <a
          href="/dashboard/catalog"
          className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
        >
          Manage
        </a>
      </div>
    );
  }
  const preordered = Boolean(releaseAt && new Date(releaseAt) > new Date());
  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <span className="font-mono text-xs text-forest">
        {preordered ? "✓ Pre-ordered — plays in full on release day" : "✓ You own this song"}
      </span>
      <a
        href="/library"
        className="font-mono text-xs px-3 py-1.5 rounded border border-forest/40 text-forest hover:bg-forest/10"
      >
        My Library
      </a>
    </div>
  );
}

export default function TrackAudio({
  trackId,
  previewUrl,
  className = "w-full h-9 mt-3",
  releaseAt = null,
}: {
  trackId: string;
  previewUrl: string | null;
  className?: string;
  // A pre-order stays preview-only until release (the stream route enforces
  // this too).
  releaseAt?: string | null;
}) {
  const owned = useOwnsTrack(trackId);

  const preordered = Boolean(releaseAt && new Date(releaseAt) > new Date());
  // The artist hears their own song in full even before a pre-order release.
  const full = owned === "mine" || (owned === "bought" && !preordered);
  const src = full ? `/api/stream/${trackId}` : previewUrl;
  if (!src) return null;

  return (
    <div className={className}>
      {/* key forces a fresh <audio> when switching preview -> full song */}
      <audio key={src} controls src={src} className="w-full h-9" preload="none" />
      {full && (
        <p className="font-mono text-[11px] text-forest mt-1">
          {owned === "mine" ? "★ Your song — playing in full" : "✓ You own this — playing the full song"}
        </p>
      )}
    </div>
  );
}
