"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPreviewPhase, clearPreviewPhase } from "@/app/actions/phase";
import { PHASES, MAX_PHASE, type Phase } from "@/lib/phases";

// Investor demo control, shown only to the admin account. Click a phase to
// see the app exactly as it will look at that release; the public site is
// never affected. "Hide" tucks it into a small tab for clean screen-sharing.
export default function PhaseSwitcher({
  phase,
  livePhase,
  previewing,
}: {
  phase: Phase;
  livePhase: Phase;
  previewing: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(true);

  const go = (next: Phase) =>
    startTransition(async () => {
      await setPreviewPhase(next);
      router.refresh();
    });

  const reset = () =>
    startTransition(async () => {
      await clearPreviewPhase();
      router.refresh();
    });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 font-mono text-xs px-3 py-2 rounded-full bg-black/80 border border-gold/50 text-gold shadow-lg"
        aria-label="Show phase switcher"
      >
        Phase {phase}
      </button>
    );
  }

  const phases = Array.from({ length: MAX_PHASE }, (_, i) => (i + 1) as Phase);
  const info = PHASES[phase];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(96vw,720px)] rounded-2xl bg-black/90 border border-gold/40 shadow-2xl px-4 py-3 text-paper">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-gold">
          Investor demo {previewing ? "· preview" : "· live site"}
        </p>
        <div className="flex items-center gap-3 font-mono text-[11px] text-paper/60">
          {previewing && (
            <button onClick={reset} disabled={pending} className="hover:text-gold">
              Back to live (Phase {livePhase})
            </button>
          )}
          <button onClick={() => setOpen(false)} className="hover:text-gold">
            Hide
          </button>
        </div>
      </div>

      <div className="flex gap-1.5">
        {phases.map((p) => (
          <button
            key={p}
            onClick={() => go(p)}
            disabled={pending}
            className={`flex-1 rounded-lg py-2 font-mono text-sm border transition ${
              p === phase
                ? "bg-gold text-black border-gold font-semibold"
                : p < phase
                ? "border-gold/40 text-gold"
                : "border-paper/20 text-paper/60 hover:border-gold/60"
            }`}
            aria-pressed={p === phase}
            title={`${PHASES[p].name} · ${PHASES[p].target}`}
          >
            {p}
          </button>
        ))}
      </div>

      <p className="mt-2 text-sm">
        <span className="font-semibold">
          Phase {phase}: {info.name}
        </span>{" "}
        <span className="text-paper/50 font-mono text-xs">· {info.target}</span>
      </p>
      <p className="text-paper/60 text-xs">{pending ? "Switching…" : info.summary}</p>
    </div>
  );
}
