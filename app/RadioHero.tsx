"use client";

import { useRadio } from "./RadioProvider";

// The homepage's way into Fyby Radio (Phase 10): "the radio station where
// every song has a Buy button." Renders nothing until the radio is switched
// on (NEXT_PUBLIC_RADIO_ENABLED) and at least one track is opted in, so the
// homepage looks exactly as before until then.
export default function RadioHero() {
  const { enabled, stations, premieres, stationSlug, track, playing, loading, tuneIn, togglePlay } = useRadio();
  if (!enabled || stations.length === 0) return null;

  const onAir = Boolean(stationSlug);

  return (
    <section className="mb-14 rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-ink to-flame/10 px-6 py-8 sm:px-10 sm:py-10">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-gold mb-3">
        {onAir && playing ? "● On air" : "Fyby Radio"}
      </p>
      <h2 className="font-display text-3xl sm:text-4xl leading-tight max-w-2xl">
        The radio station where every song has a Buy button.
      </h2>
      <p className="text-paper/60 mt-3 max-w-xl">
        Independent artists, nonstop. Hear something you love, buy it in one tap, and the artist keeps
        the money.
      </p>

      <ol className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
        {[
          ["Pick a station", "Tap Tune in, or choose a genre or mood below. It plays nonstop, free."],
          ["Hear it, buy it", "Love a song? Tap Buy in the player at the bottom of your screen. The artist keeps the money."],
          ["Keep listening", "The radio keeps playing while you browse Fyby. Tap ⏭ to skip or ✕ to turn it off."],
        ].map(([title, body], i) => (
          <li key={title} className="rounded-lg border border-paper/15 bg-paper/5 px-4 py-3">
            <p className="font-display text-sm text-gold">
              {i + 1}. {title}
            </p>
            <p className="text-paper/60 text-xs mt-1">{body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => (onAir ? togglePlay() : tuneIn())}
          disabled={loading}
          className="font-mono text-sm px-6 py-3 rounded-full bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-60"
        >
          {!onAir ? "▶ Tune in" : playing ? "❚❚ Pause" : "▶ Resume"}
        </button>
        {onAir && track && (
          <span className="font-mono text-xs text-paper/60">
            Now playing: <span className="text-paper">{track.title}</span> · {track.artistName}
          </span>
        )}
      </div>

      {premieres.length > 0 && (
        <div className="mt-7">
          <p className="font-mono text-xs uppercase tracking-widest text-flame mb-3">Premiering now</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {premieres.map((p) => (
              <button
                key={p.trackId}
                type="button"
                onClick={() => tuneIn(p.stationSlug ?? undefined, p.trackId)}
                className="flex items-center gap-3 flex-shrink-0 rounded-lg border border-flame/40 bg-flame/5 hover:bg-flame/10 pr-4 text-left"
              >
                <span className="w-14 h-14 rounded-l-lg bg-paper/10 overflow-hidden flex-shrink-0">
                  {p.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-sm leading-tight max-w-[10rem] truncate">{p.title}</span>
                  <span className="block text-paper/60 text-xs max-w-[10rem] truncate">{p.artistName}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {stations.map((s) => (
          <button
            key={s.slug}
            type="button"
            onClick={() => tuneIn(s.slug)}
            className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors ${
              stationSlug === s.slug
                ? "border-gold bg-gold/20 text-gold"
                : "border-paper/20 text-paper/70 hover:border-gold/60 hover:text-gold"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </section>
  );
}
