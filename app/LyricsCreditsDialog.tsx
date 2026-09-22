"use client";

import { useState } from "react";

// The "Lyrics & Credits" dialog shown on a track card (app/artists/[id]/
// page.tsx) -- same idea as Apple Music's lyrics+credits sheet. Credits are
// just contributor names (contributors.name, filtered by track_id at
// upload time in app/actions/contributors.ts) -- no percentages, since the
// split itself is private business between the artist and their
// contributors, not something a buyer needs to see.
export default function LyricsCreditsDialog({
  trackTitle,
  lyrics,
  credits,
}: {
  trackTitle: string;
  lyrics: string | null;
  credits: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!lyrics && credits.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-xs text-paper/50 hover:text-gold underline mt-2"
      >
        Lyrics & Credits
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-ink border border-paper/15 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg text-gold mb-4">{trackTitle}</h3>

            {lyrics && (
              <p className="font-mono text-xs text-paper/40 uppercase mb-2">Lyrics</p>
            )}
            {lyrics && (
              <p className="font-body text-sm text-paper/80 whitespace-pre-wrap mb-6">
                {lyrics}
              </p>
            )}

            {credits.length > 0 && (
              <p className="font-mono text-xs text-paper/40 uppercase mb-2">Credits</p>
            )}
            {credits.length > 0 && (
              <p className="font-body text-sm text-paper/80 whitespace-pre-line">
                {credits.join("\n")}
              </p>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-mono text-xs text-gold underline mt-6"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
