"use client";

import { useEffect } from "react";

// Site-wide "only one song at a time" rule. There are 8+ separate places an
// <audio> tag gets rendered (homepage featured tracks, storefront/browse
// grids, the artist directory sample player, an artist's own catalog, the
// dashboard track list, the embeddable widget, the library, and the
// post-purchase download page) — rather than wiring shared state through
// every one of those components, this listens once at the document level
// for any media element starting playback anywhere on the page, and pauses
// every other one that's still going.
//
// Media "play" events don't bubble, so a normal document.addEventListener
// on the bubble phase would never see them. Capture-phase listening still
// works, though: the browser walks every ancestor on the way DOWN to the
// event's target regardless of whether that event bubbles back up, so a
// single capturing listener on `document` sees every play event on every
// <audio>/<video> on the page, no matter how deeply nested.
export default function GlobalAudioManager() {
  useEffect(() => {
    function handlePlay(event: Event) {
      const target = event.target as HTMLMediaElement;
      if (!(target instanceof HTMLMediaElement)) return;

      document.querySelectorAll("audio, video").forEach((el) => {
        const media = el as HTMLMediaElement;
        if (media !== target && !media.paused) {
          media.pause();
        }
      });
    }

    document.addEventListener("play", handlePlay, true);
    return () => document.removeEventListener("play", handlePlay, true);
  }, []);

  return null;
}
