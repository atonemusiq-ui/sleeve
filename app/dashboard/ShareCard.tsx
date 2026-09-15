"use client";

import { useState } from "react";

// The mic-badge QR graphic from app/artists/[id]/share-card/route.tsx,
// previewed here with a download link and a suggested caption to paste
// alongside it. Instagram, TikTok, and Snapchat don't unfurl a real link
// inside a post — this graphic is the workaround: fans scan the mic to land
// on the artist's Fyby page instead of tapping a link that wouldn't be
// clickable there anyway.
export default function ShareCard({ artistId, artistName }: { artistId: string; artistName: string }) {
  const [copied, setCopied] = useState(false);

  // Cache-bust on every page load. Confirmed live: an artist id that got
  // hit once under an older version of this graphic kept serving that exact
  // cached image from an upstream cache even after the route's own
  // Cache-Control was shortened — a fresh query string sidesteps that
  // entirely by always asking for a URL no cache has seen before, so an
  // artist previewing or downloading here always gets the current design.
  const [cacheBust] = useState(() => Date.now());
  const imageUrl = `/artists/${artistId}/share-card?v=${cacheBust}`;
  const caption = `🎤 New music is up — scan the mic to hear it on Fyby! ${
    typeof window !== "undefined" ? window.location.origin : ""
  }/artists/${artistId}`;

  async function handleCopyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the caption is still
      // visible below to copy by hand.
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="w-32 h-32 rounded-lg overflow-hidden border border-paper/15 bg-paper/5 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Social share graphic preview" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <a
          href={imageUrl}
          download={`fyby-${artistName.toLowerCase().replace(/\s+/g, "-")}-share-card.png`}
          className="self-start font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90"
        >
          Download share image
        </a>
        <p className="font-mono text-xs text-paper/60">
          Post this as an image on Instagram, TikTok, or Snapchat — the QR code takes fans straight
          to your Fyby page since those apps won't let you drop a tappable link into a caption.
          Suggested caption:
        </p>
        <div className="flex items-start gap-2">
          <textarea
            readOnly
            value={caption}
            rows={2}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 bg-ink border border-paper/20 rounded px-2 py-1.5 text-paper font-mono text-xs"
          />
          <button
            type="button"
            onClick={handleCopyCaption}
            className="font-mono text-xs px-2 py-1.5 rounded border border-paper/20 hover:bg-paper/10 flex-shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="font-mono text-xs text-paper/40">
          On Facebook and X/Twitter, just paste your{" "}
          <span className="text-paper/60">/artists/{artistId}</span> link directly — those show a
          rich preview automatically.
        </p>
      </div>
    </div>
  );
}
