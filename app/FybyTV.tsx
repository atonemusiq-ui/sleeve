"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import VideoEmbed from "./VideoEmbed";
import { startCheckout } from "@/app/actions/checkout";
import { TV_CATEGORIES, type TvCategory, type TvVideo } from "@/lib/fybyTv";

// Fyby TV (Phase 10): the homepage video player. One big player plus a
// playlist, with channels for artist Premieres, What's New, and How-To.
// Videos come from app/page.tsx (lib/fybyTvServer.ts). A premiere scheduled
// for later shows a countdown instead of the video until it starts.

const CHANNEL_ORDER: TvCategory[] = ["premiere", "whats_new", "how_to"];

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function countdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
}

export default function FybyTV({ videos, isLoggedIn }: { videos: TvVideo[]; isLoggedIn: boolean }) {
  const now = useNow(1000);
  const channels = useMemo(() => CHANNEL_ORDER.filter((c) => videos.some((v) => v.category === c)), [videos]);
  const [channel, setChannel] = useState<TvCategory>(channels[0] ?? "whats_new");
  const inChannel = videos.filter((v) => v.category === channel);
  const [selectedId, setSelectedId] = useState<string | null>(inChannel[0]?.id ?? null);
  const selected = inChannel.find((v) => v.id === selectedId) ?? inChannel[0] ?? null;

  function pickChannel(c: TvCategory) {
    setChannel(c);
    setSelectedId(videos.find((v) => v.category === c)?.id ?? null);
  }

  const notStartedYet = selected?.startsAt ? new Date(selected.startsAt).getTime() > now : false;

  return (
    <section aria-label="Fyby TV" className="mb-14 rounded-2xl border border-paper/15 bg-paper/5 px-6 py-8 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-gold">🎬 Fyby TV</p>
            <span className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-flame text-ink font-medium">
              New
            </span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl mt-2">Premieres, news, and how-tos</h2>
        </div>
        {channels.length > 0 && (
          <div className="flex flex-wrap gap-2" role="tablist">
            {channels.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={channel === c}
                onClick={() => pickChannel(c)}
                className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  channel === c
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-paper/20 text-paper/70 hover:border-gold/60 hover:text-gold"
                }`}
              >
                {TV_CATEGORIES[c].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selected ? (
        <div className="rounded-xl border border-dashed border-paper/20 px-6 py-12 text-center">
          <p className="font-display text-lg">First episodes coming soon</p>
          <p className="text-paper/50 text-sm mt-1">
            Feature announcements, tutorials, and music video premieres from Fyby artists.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-6">
          <div>
            {notStartedYet ? (
              <div className="w-full aspect-video rounded-lg bg-ink border border-flame/40 flex flex-col items-center justify-center text-center px-6">
                <p className="font-mono text-xs uppercase tracking-widest text-flame">Premieres in</p>
                <p className="font-display text-4xl sm:text-5xl mt-2 tabular-nums">
                  {countdown(new Date(selected.startsAt!).getTime() - now)}
                </p>
                <p className="text-paper/60 text-sm mt-3">{new Date(selected.startsAt!).toLocaleString()}</p>
              </div>
            ) : (
              <VideoEmbed key={selected.id} type="link" url={selected.videoUrl} />
            )}
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {selected.category === "premiere" && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-flame mb-1">
                    {notStartedYet ? "Upcoming premiere" : "Premiere"}
                  </p>
                )}
                <h3 className="font-display text-xl leading-tight">{selected.title}</h3>
                {selected.artistId && selected.artistName && (
                  <Link href={`/artists/${selected.artistId}`} className="text-paper/60 text-sm hover:text-gold">
                    {selected.artistName}
                  </Link>
                )}
                {selected.description && <p className="text-paper/60 text-sm mt-2 max-w-2xl">{selected.description}</p>}
              </div>
              {selected.trackId && selected.trackPriceCents != null && !notStartedYet && (
                <form action={startCheckout}>
                  <input type="hidden" name="trackId" value={selected.trackId} />
                  <input type="hidden" name="returnTo" value="/" />
                  <button
                    type="submit"
                    className="font-mono text-sm px-4 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90"
                  >
                    {isLoggedIn ? "Buy the song" : "Log in to buy"} ${(selected.trackPriceCents / 100).toFixed(2)}
                  </button>
                </form>
              )}
            </div>
          </div>

          <ul className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible lg:max-h-[26rem] lg:overflow-y-auto">
            {inChannel.map((v) => (
              <li key={v.id} className="flex-shrink-0 w-56 lg:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    v.id === selected.id ? "border-gold bg-gold/10" : "border-paper/15 hover:border-gold/50"
                  }`}
                >
                  <span className="block font-display text-sm leading-tight line-clamp-2">{v.title}</span>
                  <span className="block font-mono text-[11px] text-paper/50 mt-1">
                    {v.artistName ?? TV_CATEGORIES[v.category].label}
                    {v.startsAt && new Date(v.startsAt).getTime() > now ? " · upcoming" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
