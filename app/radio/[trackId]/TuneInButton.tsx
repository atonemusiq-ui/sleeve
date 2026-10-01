"use client";

import { useRadio } from "@/app/RadioProvider";

export default function TuneInButton({ stationSlug, trackId }: { stationSlug: string; trackId: string }) {
  const { tuneIn, track, playing, togglePlay, loading } = useRadio();
  const thisSongOn = track?.id === trackId;

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => (thisSongOn ? togglePlay() : tuneIn(stationSlug, trackId))}
      className="font-mono text-sm px-8 py-3.5 rounded-full bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-60"
    >
      {thisSongOn ? (playing ? "❚❚ Pause" : "▶ Resume") : "▶ Tune in and hear it"}
    </button>
  );
}
