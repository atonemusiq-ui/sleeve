"use client";

import { useEffect, useState } from "react";
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
const ownedByUser = new Map<string, Promise<Set<string>>>();

async function loadOwnedTrackIds(): Promise<Set<string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return new Set<string>();

  const cached = ownedByUser.get(userId);
  if (cached) return cached;

  const promise = (async () => {
    // RLS already limits both tables to the caller's own rows.
    const [{ data: purchases }, { data: licenses }] = await Promise.all([
      supabase.from("purchases").select("track_id").eq("fan_id", userId).eq("status", "complete"),
      supabase.from("license_purchases").select("track_id").eq("buyer_id", userId).eq("status", "complete"),
    ]);
    const ids = new Set<string>();
    for (const row of [...(purchases ?? []), ...(licenses ?? [])]) {
      if (row?.track_id) ids.add(row.track_id);
    }
    return ids;
  })().catch(() => {
    // A failed lookup just falls back to previews; try again next time.
    ownedByUser.delete(userId);
    return new Set<string>();
  });
  ownedByUser.set(userId, promise);
  return promise;
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
  const [owned, setOwned] = useState(false);

  useEffect(() => {
    let alive = true;
    loadOwnedTrackIds().then((ids) => {
      if (alive) setOwned(ids.has(trackId));
    });
    return () => {
      alive = false;
    };
  }, [trackId]);

  const preordered = Boolean(releaseAt && new Date(releaseAt) > new Date());
  const full = owned && !preordered;
  const src = full ? `/api/stream/${trackId}` : previewUrl;
  if (!src) return null;

  return (
    <div className={className}>
      {/* key forces a fresh <audio> when switching preview -> full song */}
      <audio key={src} controls src={src} className="w-full h-9" preload="none" />
      {full && <p className="font-mono text-[11px] text-forest mt-1">✓ You own this — playing the full song</p>}
    </div>
  );
}
