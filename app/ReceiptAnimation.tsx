"use client";

import { useEffect, useState } from "react";

// Illustrative numbers, not pulled from any real account — the point is the
// shape of the comparison (a fraction of a cent per stream vs. a real dollar
// amount per sale), not a precise streaming-rate citation.
const STREAMING_PAYOUT_CENTS = 300; // ~1,000 streams at a typical per-stream rate
const FYBY_PAYOUT_CENTS = 400; // one $5 track sale at the 80/20 split

export default function ReceiptAnimation() {
  const [fybyCents, setFybyCents] = useState(0);

  useEffect(() => {
    // Counts up from $0 to the Fyby payout once, on mount — a small,
    // tasteful reveal rather than a looping animation.
    const durationMs = 900;
    const stepMs = 20;
    const steps = durationMs / stepMs;
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      setFybyCents(Math.min(FYBY_PAYOUT_CENTS, Math.round((FYBY_PAYOUT_CENTS * step) / steps)));
      if (step >= steps) clearInterval(id);
    }, stepMs);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="animate-fade-rise border border-paper/15 rounded-lg bg-paper/5 p-6 font-mono text-sm max-w-sm mx-auto w-full">
      <p className="text-paper/50 text-xs mb-4">One song: sold once vs. streamed ~1,000 times</p>

      <div className="flex items-center justify-between py-2 border-b border-dashed border-paper/15">
        <span className="text-paper/60">Streaming payout</span>
        <span className="text-paper/60">${(STREAMING_PAYOUT_CENTS / 100).toFixed(2)}</span>
      </div>

      <div className="flex items-center justify-between py-2">
        <span className="text-paper">Fyby payout</span>
        <span className="text-gold text-lg font-medium">${(fybyCents / 100).toFixed(2)}</span>
      </div>

      <p className="text-paper/40 text-xs mt-4">
        Based on a $5 track sale at Fyby's 80/20 split vs. ~1,000 streams at a typical
        per-stream rate. Illustrative, not a guarantee.
      </p>
    </div>
  );
}
