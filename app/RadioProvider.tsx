"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startCheckout } from "@/app/actions/checkout";
import { FRESH_STATION_SLUG, RECENT_HISTORY_LIMIT, isRadioEnabled, type Station } from "@/lib/radio";

// Fyby Radio (Phase 10). Lives in the root layout (app/layout.tsx), so the
// music keeps playing while a fan clicks around the site: App Router layouts
// don't remount on client-side navigation. Anything on any page can tune in
// through useRadio(); the homepage's RadioHero is the main way in.
//
// Browsers block audio that starts on its own, so nothing plays until the
// fan taps "Tune in". GlobalAudioManager.tsx still applies: playing a
// preview anywhere pauses the radio, and the bar shows it as paused.

type RadioTrack = {
  id: string;
  title: string;
  priceCents: number;
  coverUrl: string | null;
  explicit: boolean;
  aiDisclosure: string | null;
  isPremiere: boolean;
  artistId: string;
  artistName: string;
  audioUrl: string;
};

export type RadioPremiere = {
  trackId: string;
  title: string;
  coverUrl: string | null;
  artistName: string;
  stationSlug: string | null;
};

type RadioContextValue = {
  enabled: boolean;
  stations: Station[];
  premieres: RadioPremiere[];
  stationSlug: string | null;
  track: RadioTrack | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  // firstTrackId plays that song first (shared radio links, premieres).
  tuneIn: (slug?: string, firstTrackId?: string) => void;
  togglePlay: () => void;
  skip: () => void;
  stop: () => void;
};

const RadioContext = createContext<RadioContextValue | null>(null);

export function useRadio(): RadioContextValue {
  const value = useContext(RadioContext);
  if (!value) throw new Error("useRadio must be used inside RadioProvider");
  return value;
}

function newSessionId(): string {
  try {
    const existing = sessionStorage.getItem("fyby-radio-session");
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem("fyby-radio-session", id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export default function RadioProvider({
  children,
  phaseAllows = true,
}: {
  children: React.ReactNode;
  // False until the release phase that ships Fyby Radio (lib/phases.ts).
  phaseAllows?: boolean;
}) {
  const enabled = isRadioEnabled() && phaseAllows;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recentRef = useRef<string[]>([]);
  const sessionRef = useRef<string>("");
  const failuresRef = useRef(0);

  const [stations, setStations] = useState<Station[]>([]);
  const [premieres, setPremieres] = useState<RadioPremiere[]>([]);
  const [stationSlug, setStationSlug] = useState<string | null>(null);
  const [track, setTrack] = useState<RadioTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    sessionRef.current = newSessionId();
    fetch("/api/radio/stations")
      .then((res) => (res.ok ? res.json() : { stations: [], premieres: [] }))
      .then((data) => {
        setStations(data.stations ?? []);
        setPremieres(data.premieres ?? []);
      })
      .catch(() => setStations([]));
  }, [enabled]);

  const playNext = useCallback(async (slug: string, firstTrackId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        station: slug,
        recent: recentRef.current.join(","),
        session: sessionRef.current,
      });
      if (firstTrackId) params.set("first", firstTrackId);
      const res = await fetch(`/api/radio/next?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load the next song.");

      const next: RadioTrack = data.track;
      recentRef.current = [next.id, ...recentRef.current.filter((id) => id !== next.id)].slice(
        0,
        RECENT_HISTORY_LIMIT
      );
      setTrack(next);

      const audio = audioRef.current;
      if (audio) {
        audio.src = next.audioUrl;
        await audio.play();
      }
      failuresRef.current = 0;
    } catch (err: any) {
      setPlaying(false);
      setError(err?.message ?? "Fyby Radio hit a snag.");
    } finally {
      setLoading(false);
    }
  }, []);

  const tuneIn = useCallback(
    (slug?: string, firstTrackId?: string) => {
      const target = slug ?? stationSlug ?? FRESH_STATION_SLUG;
      setStationSlug(target);
      void playNext(target, firstTrackId);
    },
    [playNext, stationSlug]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!track) {
      tuneIn();
      return;
    }
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [track, tuneIn]);

  const skip = useCallback(() => {
    if (stationSlug) void playNext(stationSlug);
  }, [playNext, stationSlug]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setTrack(null);
    setStationSlug(null);
  }, []);

  function handleEnded() {
    if (stationSlug) void playNext(stationSlug);
  }

  // An expired or broken audio URL: move on to another song, but give up
  // after a few in a row rather than looping forever.
  function handleAudioError() {
    if (!stationSlug || !track) return;
    failuresRef.current += 1;
    if (failuresRef.current <= 3) void playNext(stationSlug);
    else {
      setPlaying(false);
      setError("Fyby Radio is having trouble playing right now.");
    }
  }

  const value: RadioContextValue = {
    enabled,
    stations,
    premieres,
    stationSlug,
    track,
    playing,
    loading,
    error,
    tuneIn,
    togglePlay,
    skip,
    stop,
  };

  return (
    <RadioContext.Provider value={value}>
      {children}
      {enabled && (
        <>
          <audio
            ref={audioRef}
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={handleEnded}
            onError={handleAudioError}
            className="hidden"
          />
          {stationSlug && (
            <>
              {/* Spacer so the fixed bar never covers the bottom of a page. */}
              <div aria-hidden className="h-24" />
              <RadioBar sessionId={sessionRef.current} />
            </>
          )}
        </>
      )}
    </RadioContext.Provider>
  );
}

function RadioBar({ sessionId }: { sessionId: string }) {
  const { stations, stationSlug, track, playing, loading, error, tuneIn, togglePlay, skip, stop } = useRadio();
  const pathname = usePathname();

  // Logged before the checkout form submits; sendBeacon survives the page
  // navigating away to Stripe.
  function logBuyClick() {
    if (!track) return;
    const payload = JSON.stringify({ trackId: track.id, station: stationSlug, event: "buy_click", session: sessionId });
    try {
      navigator.sendBeacon?.("/api/radio/event", new Blob([payload], { type: "application/json" }));
    } catch {
      // analytics only; never block a purchase over it
    }
  }

  return (
    <div
      role="region"
      aria-label="Fyby Radio player"
      className="fixed bottom-0 inset-x-0 z-50 border-t border-gold/40 bg-ink/95 backdrop-blur"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="w-14 h-14 rounded bg-paper/10 overflow-hidden flex-shrink-0">
          {track?.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-paper/30 text-xl">📻</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gold">
            Fyby Radio{track?.isPremiere ? " · Premiere" : ""}{loading ? " · tuning…" : ""}
          </p>
          {track ? (
            <>
              <p className="font-display text-base leading-tight truncate">
                {track.title}
                {track.explicit && <span className="ml-2 font-mono text-[10px] text-rust align-middle">E</span>}
              </p>
              <Link href={`/artists/${track.artistId}`} className="text-paper/60 text-sm hover:text-gold truncate block">
                {track.artistName}
              </Link>
            </>
          ) : (
            <p className="text-paper/60 text-sm truncate">{error ?? "Tuning in…"}</p>
          )}
        </div>

        <select
          value={stationSlug ?? ""}
          onChange={(e) => tuneIn(e.target.value)}
          aria-label="Station"
          className="hidden sm:block bg-ink border border-paper/20 rounded px-2 py-1.5 text-paper font-mono text-xs max-w-[11rem]"
        >
          {stations.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="w-10 h-10 rounded-full bg-paper/10 hover:bg-paper/20 flex items-center justify-center flex-shrink-0"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          onClick={skip}
          disabled={loading}
          aria-label="Next song"
          className="hidden sm:flex w-10 h-10 rounded-full bg-paper/10 hover:bg-paper/20 items-center justify-center flex-shrink-0 disabled:opacity-40"
        >
          ⏭
        </button>

        {track && (
          <form action={startCheckout} onSubmit={logBuyClick} className="flex-shrink-0">
            <input type="hidden" name="trackId" value={track.id} />
            <input type="hidden" name="returnTo" value={pathname || "/"} />
            <button
              type="submit"
              className="font-mono text-sm px-4 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90"
            >
              Buy ${(track.priceCents / 100).toFixed(2)}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={stop}
          aria-label="Close radio"
          className="text-paper/40 hover:text-paper font-mono text-sm px-1 flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
