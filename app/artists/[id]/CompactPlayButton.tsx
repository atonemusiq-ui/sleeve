"use client";

import { useEffect, useRef, useState } from "react";
import { useOwnsTrack } from "@/app/TrackAudio";

// The small round play button that sits on a song's cover on the artist
// page. Same rule as app/TrackAudio.tsx: the artist and buyers hear the full
// song through /api/stream (which re-checks ownership), everyone else hears
// the 15-second preview. It tells MiniPlayer.tsx what's playing through a
// window event, and MiniPlayer's pause button talks back the same way.
// GlobalAudioManager still makes sure only one song plays at a time.
export default function CompactPlayButton({
  trackId,
  previewUrl,
  releaseAt = null,
  title,
  artistName,
}: {
  trackId: string;
  previewUrl: string | null;
  releaseAt?: string | null;
  title: string;
  artistName: string;
}) {
  const owned = useOwnsTrack(trackId);
  const preordered = Boolean(releaseAt && new Date(releaseAt) > new Date());
  const full = owned === "mine" || (owned === "bought" && !preordered);
  const src = full ? `/api/stream/${trackId}` : previewUrl;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trackId?: string } | undefined;
      if (detail?.trackId !== trackId) return;
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    };
    window.addEventListener("fyby:player-toggle", onToggle);
    return () => window.removeEventListener("fyby:player-toggle", onToggle);
  }, [trackId]);

  if (!src) return null;

  const announce = (state: { playing: boolean; progress?: number }) => {
    window.dispatchEvent(
      new CustomEvent("fyby:now-playing", { detail: { trackId, title, artistName, full, ...state } })
    );
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={`${playing ? "Pause" : "Play"} ${title}`}
        className={`absolute inset-0 flex items-center justify-center bg-ink/40 transition-opacity focus-visible:opacity-100 ${
          playing ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        }`}
      >
        <span className="w-9 h-9 rounded-full bg-flame flex items-center justify-center shadow-lg">
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="#16121A" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4l13 8-13 8z" fill="#16121A" />
            </svg>
          )}
        </span>
      </button>
      {/* key forces a fresh <audio> when switching preview -> full song */}
      <audio
        key={src}
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => {
          setPlaying(true);
          announce({ playing: true });
        }}
        onPause={() => {
          setPlaying(false);
          announce({ playing: false });
        }}
        onEnded={() => {
          setPlaying(false);
          announce({ playing: false, progress: 0 });
        }}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (audio.duration) announce({ playing: !audio.paused, progress: audio.currentTime / audio.duration });
        }}
      />
    </>
  );
}
