"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTvVideo, setTvVideoPublished } from "@/app/actions/fybyTv";

type Row = {
  id: string;
  category: string;
  title: string;
  videoUrl: string;
  published: boolean;
  sortOrder: number;
  endsAt: string | null;
  amountCents: number;
  artistName: string | null;
};

export default function TvAdminRow({ video }: { video: Row }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run(fn: () => Promise<{ error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  const isPremiere = video.category === "premiere";

  return (
    <li className="flex flex-wrap items-center gap-3 border border-paper/15 rounded px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm truncate">
          {video.title}
          {!video.published && <span className="ml-2 font-mono text-[10px] text-rust">HIDDEN</span>}
        </p>
        <p className="font-mono text-[11px] text-paper/50 truncate">
          {isPremiere
            ? `${video.artistName ?? "Artist"} · $${(video.amountCents / 100).toFixed(2)}${
                video.endsAt ? ` · ends ${new Date(video.endsAt).toLocaleDateString()}` : ""
              }`
            : `Order ${video.sortOrder}`}{" "}
          ·{" "}
          <a href={video.videoUrl} target="_blank" rel="noreferrer" className="text-gold">
            link
          </a>
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => setTvVideoPublished(video.id, !video.published))}
        className="font-mono text-xs px-2 py-1 rounded border border-paper/30 hover:border-gold disabled:opacity-50"
      >
        {video.published ? "Hide" : "Show"}
      </button>
      {!isPremiere && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm(`Delete "${video.title}" from Fyby TV?`)) void run(() => deleteTvVideo(video.id));
          }}
          className="font-mono text-xs px-2 py-1 rounded border border-rust/50 text-rust hover:bg-rust/10 disabled:opacity-50"
        >
          Delete
        </button>
      )}
      {error && <p className="w-full font-mono text-xs text-rust">{error}</p>}
    </li>
  );
}
