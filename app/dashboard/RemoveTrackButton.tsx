"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeTrack, restoreTrack } from "@/app/actions/tracks";

// Remove (or restore) one of the artist's own songs. Used in their catalog
// (TrackList.tsx) and on their own public artist page. See removeTrack in
// app/actions/tracks.ts for what happens to songs with and without sales.
export default function RemoveTrackButton({
  trackId,
  title,
  mode = "remove",
  compact = false,
}: {
  trackId: string;
  title: string;
  mode?: "remove" | "restore";
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    if (mode === "remove") {
      const ok = window.confirm(
        `Remove "${title}" from Fyby?\n\nIt comes off your page and can't be bought anymore. ` +
          `If anyone already bought it, they keep it, and you can restore it later from your catalog. ` +
          `If nobody has bought it, it's deleted for good.`
      );
      if (!ok) return;
    }
    setBusy(true);
    const result = mode === "remove" ? await removeTrack(trackId) : await restoreTrack(trackId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const label = mode === "remove" ? (compact ? "🗑 Remove" : "Remove song") : "Restore song";
  const style =
    mode === "remove"
      ? "border-rust/40 text-rust hover:bg-rust/10"
      : "border-forest/50 text-forest hover:bg-forest/10";

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={mode === "remove" ? "Remove this song" : "Put this song back on your page"}
        className={`font-mono text-xs px-2 py-1 rounded border disabled:opacity-50 ${style}`}
      >
        {busy ? "..." : label}
      </button>
      {error && <span className="font-mono text-[11px] text-rust max-w-[16rem]">{error}</span>}
    </span>
  );
}
