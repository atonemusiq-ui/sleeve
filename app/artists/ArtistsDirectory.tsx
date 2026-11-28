"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type DirectoryArtist = {
  id: string;
  name: string;
  photo: string | null;
  genre: string | null;
  genres: string[];
  trackCount: number;
  sample: { id: string; title: string; previewUrl: string } | null;
};

const NEW_TAB = "New on Fyby";

// The artists directory: search, genre chips, and round artist tiles in the
// style of a music app. Artists with songs sit in "Popular on Fyby" with a
// hover play button (15-second preview through the shared MiniPlayer);
// artists still getting ready sit in "New on Fyby".
export default function ArtistsDirectory({ artists }: { artists: DirectoryArtist[] }) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string>("All");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRef = useRef<DirectoryArtist | null>(null);

  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of artists) for (const g of a.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([g]) => g);
  }, [artists]);

  const q = query.trim().toLowerCase();
  const matches = (a: DirectoryArtist) =>
    (!q || a.name.toLowerCase().includes(q) || (a.genre ?? "").toLowerCase().includes(q)) &&
    (genre === "All" || genre === NEW_TAB || a.genres.includes(genre));

  const popular = genre === NEW_TAB ? [] : artists.filter((a) => a.trackCount > 0 && matches(a));
  const upcoming = artists.filter((a) => a.trackCount === 0 && matches(a));

  const announce = (a: DirectoryArtist, playing: boolean, progress?: number) => {
    if (!a.sample) return;
    window.dispatchEvent(
      new CustomEvent("fyby:now-playing", {
        detail: { trackId: a.sample.id, title: a.sample.title, artistName: a.name, full: false, playing, progress },
      })
    );
  };

  // One shared player for the whole page.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    const onPlay = () => {
      const a = currentRef.current;
      if (a) {
        setPlayingId(a.id);
        announce(a, true);
      }
    };
    const onPause = () => {
      const a = currentRef.current;
      setPlayingId(null);
      if (a) announce(a, false);
    };
    const onEnded = () => {
      const a = currentRef.current;
      setPlayingId(null);
      if (a) announce(a, false, 0);
    };
    const onTime = () => {
      const a = currentRef.current;
      if (a && audio.duration) announce(a, !audio.paused, audio.currentTime / audio.duration);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTime);
    const onToggle = (e: Event) => {
      const id = (e as CustomEvent).detail?.trackId;
      if (!currentRef.current?.sample || currentRef.current.sample.id !== id) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    };
    window.addEventListener("fyby:player-toggle", onToggle);
    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTime);
      window.removeEventListener("fyby:player-toggle", onToggle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (a: DirectoryArtist) => {
    const audio = audioRef.current;
    if (!audio || !a.sample) return;
    if (currentRef.current?.id === a.id) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    audio.pause();
    currentRef.current = a;
    audio.src = a.sample.previewUrl;
    audio.play().catch(() => {});
  };

  const chip = (active: boolean) =>
    `flex-shrink-0 text-xs sm:text-[13px] px-3.5 py-1.5 rounded-full border transition-colors ${
      active ? "bg-paper text-ink border-paper" : "border-paper/20 text-paper/75 hover:border-paper/50"
    }`;

  const Avatar = ({ a, size }: { a: DirectoryArtist; size: "lg" | "sm" }) =>
    a.photo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={a.photo} alt="" className="w-full h-full object-cover" loading="lazy" />
    ) : (
      <div
        className={`w-full h-full flex items-center justify-center font-display text-paper/45 bg-[#2B2230] ${
          size === "lg" ? "text-5xl" : "text-3xl"
        }`}
      >
        {a.name.charAt(0).toUpperCase()}
      </div>
    );

  return (
    <div>
      {/* Search + genre chips */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <label className="relative flex-1 sm:max-w-sm">
          <span className="sr-only">Search artists</span>
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-paper/45"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists or genres"
            className="w-full h-10 rounded-full bg-paper/[0.08] border border-transparent focus:border-paper/30 outline-none pl-10 pr-4 text-sm text-paper placeholder:text-paper/45"
          />
        </label>
      </div>
      <nav aria-label="Filter by genre" className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-6">
        {["All", ...genres, NEW_TAB].map((g) => (
          <button key={g} type="button" onClick={() => setGenre(g)} className={chip(genre === g)}>
            {g}
          </button>
        ))}
      </nav>

      {popular.length > 0 && (
        <section aria-labelledby="popular-heading" className="mb-10">
          <h2 id="popular-heading" className="font-display text-2xl mb-2">
            {genre === "All" ? "Popular on Fyby" : genre}
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2 gap-y-1">
            {popular.map((a) => {
              const on = playingId === a.id;
              return (
                <li key={a.id} className="group rounded-xl p-2.5 sm:p-3 hover:bg-paper/[0.06] transition-colors">
                  <div className="relative">
                    <Link
                      href={`/artists/${a.id}`}
                      aria-label={a.name}
                      className="block aspect-square rounded-full overflow-hidden shadow-xl bg-[#2B2230]"
                    >
                      <Avatar a={a} size="lg" />
                    </Link>
                  {a.sample && (
                    <button
                      type="button"
                      onClick={() => toggle(a)}
                      aria-label={`${on ? "Pause" : "Play"} ${a.sample.title} by ${a.name}`}
                      className={`absolute right-[4%] bottom-[4%] w-11 h-11 rounded-full bg-flame text-ink shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 focus-visible:opacity-100 ${
                        on
                          ? "opacity-100 translate-y-0"
                          : "opacity-100 sm:opacity-0 sm:translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0"
                      }`}
                    >
                      {on ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M7 4l13 8-13 8z" fill="currentColor" />
                        </svg>
                      )}
                    </button>
                  )}
                  </div>
                  <Link href={`/artists/${a.id}`} className="block">
                    <p className="mt-3 font-semibold text-[15px] text-paper truncate">{a.name}</p>
                    <p className="text-[13px] text-paper/55 truncate">
                      {a.genre ?? "Artist"} · {a.trackCount} {a.trackCount === 1 ? "song" : "songs"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (genre === "All" || genre === NEW_TAB || q) && (
        <section aria-labelledby="new-heading" className="mb-10">
          <h2 id="new-heading" className="font-display text-2xl mb-2">
            New on Fyby
          </h2>
          <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-1 gap-y-1">
            {upcoming.map((a) => (
              <li key={a.id}>
                <Link href={`/artists/${a.id}`} className="block rounded-xl p-2 sm:p-2.5 hover:bg-paper/[0.06] transition-colors">
                  <div className="aspect-square rounded-full overflow-hidden bg-[#2B2230]">
                    <Avatar a={a} size="sm" />
                  </div>
                  <p className="mt-2 font-semibold text-[13px] text-paper truncate">{a.name}</p>
                  <p className="text-xs text-paper/50 truncate">Coming soon</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {popular.length === 0 && (upcoming.length === 0 || !(genre === "All" || genre === NEW_TAB || q)) && (
        <p className="text-paper/55 text-sm py-10 text-center">No artists match that yet. Try another search.</p>
      )}
    </div>
  );
}
