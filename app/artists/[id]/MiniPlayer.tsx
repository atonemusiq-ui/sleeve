"use client";

import { useEffect, useState } from "react";

type NowPlaying = {
  trackId: string;
  title: string;
  artistName: string;
  full: boolean;
  playing: boolean;
  progress?: number;
};

// The slim bar fixed to the bottom of the artist page showing what's
// playing. It only listens: CompactPlayButton.tsx announces play, pause and
// progress on the window, and this bar's button asks that song to toggle.
// Hidden until the first song is played.
export default function MiniPlayer() {
  const [now, setNow] = useState<NowPlaying | null>(null);

  useEffect(() => {
    const onNowPlaying = (e: Event) => {
      const detail = (e as CustomEvent).detail as NowPlaying;
      setNow((prev) => {
        const kept = prev && prev.trackId === detail.trackId ? prev.progress : 0;
        return { ...detail, progress: detail.progress ?? kept };
      });
    };
    window.addEventListener("fyby:now-playing", onNowPlaying);
    return () => window.removeEventListener("fyby:now-playing", onNowPlaying);
  }, []);

  if (!now) return null;

  const pct = Math.max(0, Math.min(100, Math.round((now.progress ?? 0) * 100)));

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-paper/15 bg-ink/95 backdrop-blur">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {now.title} <span className="font-normal text-paper/60">· {now.artistName}</span>
          </p>
          <div className="mt-2 h-1 rounded-full bg-paper/15 overflow-hidden">
            <div className="h-full bg-flame transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="hidden sm:inline font-mono text-[11px] text-paper/60 flex-shrink-0">
          {now.full ? "Full song" : "15-sec preview"}
        </span>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("fyby:player-toggle", { detail: { trackId: now.trackId } }))
          }
          aria-label={now.playing ? "Pause" : "Play"}
          className="w-11 h-11 rounded-full bg-paper flex items-center justify-center flex-shrink-0 hover:bg-gold"
        >
          {now.playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="#16121A" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4l13 8-13 8z" fill="#16121A" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
