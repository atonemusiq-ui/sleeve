import Link from "next/link";
import StartTimeInput from "./StartTimeInput";
import { startVideoPremiere } from "@/app/actions/fybyTv";
import { MAX_PREMIERE_LEAD_DAYS, MAX_TV_DESCRIPTION_LENGTH, MAX_TV_TITLE_LENGTH, VIDEO_PREMIERE_TIERS } from "@/lib/fybyTv";

// Phase 10: an artist premieres a music video on Fyby TV (the homepage
// video player). Pro plan only; paid per premiere at the same prices as a
// Radio Premiere. Payment and publishing: app/actions/fybyTv.ts + webhook.

const input = "w-full bg-ink border border-paper/20 rounded px-3 py-2 text-paper font-mono text-sm";

export default function VideoPremiereSection({
  isPro,
  tracks,
  activePremieres,
}: {
  isPro: boolean;
  tracks: { id: string; title: string }[];
  activePremieres: { id: string; title: string; startsAt: string | null; endsAt: string | null }[];
}) {
  return (
    <section className="mb-10 rounded-lg border border-flame/40 bg-flame/5 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg text-flame">🎬 Premiere a music video on Fyby TV</h2>
        <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-gold/50 text-gold">
          Pro
        </span>
      </div>
      <p className="font-mono text-xs text-paper/70 mt-2 max-w-2xl">
        Your video plays in the Premieres channel of the Fyby TV player on the homepage, with an optional
        countdown before it goes live and a Buy button for your song underneath.
      </p>

      {activePremieres.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 font-mono text-xs text-paper/80">
          {activePremieres.map((p) => (
            <li key={p.id}>
              ▶ {p.title}
              {p.startsAt && new Date(p.startsAt).getTime() > Date.now()
                ? ` · starts ${new Date(p.startsAt).toLocaleString()}`
                : ""}
              {p.endsAt ? ` · until ${new Date(p.endsAt).toLocaleDateString()}` : ""}
            </li>
          ))}
        </ul>
      )}

      {!isPro ? (
        <p className="font-mono text-xs text-paper/60 mt-3">
          Video Premieres are part of the Pro plan.{" "}
          <Link href="/dashboard/subscription" className="text-gold">
            See plans →
          </Link>
        </p>
      ) : (
        <form action={startVideoPremiere} className="mt-4 flex flex-col gap-3 max-w-2xl">
          <input name="title" required maxLength={MAX_TV_TITLE_LENGTH} placeholder="Video title" className={input} />
          <input name="videoUrl" required placeholder="YouTube or Vimeo link to your video" className={input} />
          <textarea
            name="description"
            rows={2}
            maxLength={MAX_TV_DESCRIPTION_LENGTH}
            placeholder="A line about the video (optional)"
            className={input}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="font-mono text-xs text-paper/60">
              Song to sell under the video (optional)
              <select name="trackId" className={`${input} mt-1`} defaultValue="">
                <option value="">No song</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-mono text-xs text-paper/60">
              Start time for a countdown (optional, within {MAX_PREMIERE_LEAD_DAYS} days)
              <StartTimeInput name="startsAt" className={`${input} mt-1`} />
            </label>
          </div>
          <div className="flex flex-wrap gap-4">
            {Object.entries(VIDEO_PREMIERE_TIERS).map(([key, t], i) => (
              <label key={key} className="flex items-center gap-1.5 font-mono text-xs text-paper/80">
                <input type="radio" name="tier" value={key} defaultChecked={i === 0} />
                {t.label} · ${(t.priceCents / 100).toFixed(2)}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="self-start font-mono text-xs px-3 py-1.5 rounded bg-flame text-ink font-medium hover:opacity-90"
          >
            Continue to payment
          </button>
        </form>
      )}
    </section>
  );
}
