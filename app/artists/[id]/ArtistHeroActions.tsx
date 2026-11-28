"use client";

import { useState } from "react";

// "Play previews" in the artist hero: starts the first song in the list by
// pressing its CompactPlayButton, so the mini-player picks it up exactly as
// if the fan had tapped the song themselves.
export function PlayPreviewsButton({ label }: { label: string }) {
  function playFirst() {
    const btn = document.querySelector<HTMLButtonElement>("[data-first-track] button");
    btn?.click();
  }
  return (
    <button
      type="button"
      onClick={playFirst}
      className="flex items-center gap-2.5 h-12 px-6 rounded-full bg-flame text-ink font-semibold text-[15px] hover:brightness-110 transition"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4l13 8-13 8z" fill="currentColor" />
      </svg>
      {label}
    </button>
  );
}

// Round share button: uses the phone's share sheet when there is one,
// otherwise copies the page link.
export function ShareArtistButton({ artistName }: { artistName: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.origin + window.location.pathname;
    try {
      if (navigator.share) {
        await navigator.share({ title: artistName + " on Fyby", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to do.
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "Link copied" : "Share artist"}
      title={copied ? "Link copied" : "Share"}
      className="w-12 h-12 rounded-full border border-paper/35 flex items-center justify-center hover:border-gold transition"
    >
      {copied ? (
        <span className="font-mono text-[10px] text-gold">Copied</span>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3v12" />
          <path d="M7 8l5-5 5 5" />
          <path d="M5 14v5h14v-5" />
        </svg>
      )}
    </button>
  );
}
