"use client";

import { useEffect, useRef, useState } from "react";

// Small play button on a song's cover in My Music. Always plays the full song
// through /api/stream (which re-checks the purchase), and talks to the same
// bottom MiniPlayer as the artist page through window events.
// GlobalAudioManager keeps it to one song at a time.
export default function LibraryPlayButton({
  trackId,
  title,
  artistName,
}: {
  trackId: string;
  title: string;
  artistName: string;
}) {
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

  const announce = (state: { playing: boolean; progress?: number }) => {
    window.dispatchEvent(
      new CustomEvent("fyby:now-playing", { detail: { trackId, title, artistName, full: true, ...state } })
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
        className={`absolute inset-0 flex items-center justify-center bg-ink/45 transition-opacity focus-visible:opacity-100 ${
          playing ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        }`}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="#E8E1D3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 4l13 8-13 8z" fill="#E8E1D3" />
          </svg>
        )}
      </button>
      <audio
        ref={audioRef}
        src={`/api/stream/${trackId}`}
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
