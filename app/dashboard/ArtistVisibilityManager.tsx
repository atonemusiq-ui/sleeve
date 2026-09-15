"use client";

import { useState, useTransition } from "react";
import { setArtistActive } from "@/app/actions/artist";

// "Cancel my artist page" — really a pause, not a delete. Nothing about the
// account, bio, tracks, or sales history changes; is_active (see
// supabase/schema.sql and app/actions/artist.ts's setArtistActive) just
// flips off, which every public-facing query filters on. Deliberately a
// two-click flow (an inline confirm panel, not a single button) so it isn't
// possible to hide a live page by mis-click.
export default function ArtistVisibilityManager({ isActive }: { isActive: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(nextActive: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setArtistActive(nextActive);
      if (result.error) {
        setError(result.error);
      } else {
        setConfirming(false);
      }
    });
  }

  if (!isActive) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs text-rust">
          Your artist page is currently hidden. Fans can&apos;t find you on the storefront, the
          artist directory, or search — and your Buy buttons are off everywhere, including any
          embed widgets you&apos;ve shared. Nothing was deleted: your bio, tracks, gallery, and
          sales history are all exactly as you left them.
        </p>
        {error && <p className="font-mono text-xs text-rust">{error}</p>}
        <button
          type="button"
          onClick={() => handleToggle(true)}
          disabled={isPending}
          className="self-start font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Reactivating…" : "Reactivate my page"}
        </button>
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs text-paper/60">
          Your page is live and visible to fans. Canceling hides it — it doesn&apos;t delete
          anything.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="self-start font-mono text-xs px-3 py-1.5 rounded border border-rust/50 text-rust hover:bg-rust/10"
        >
          Cancel my artist page
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-rust/40 rounded-lg p-4 bg-rust/5">
      <p className="font-mono text-xs text-paper">Here&apos;s exactly what happens when you cancel:</p>
      <ul className="font-mono text-xs text-paper/70 flex flex-col gap-1.5 list-disc pl-4">
        <li>Your artist page and tracks disappear from the storefront, AI Music page, and the artist directory.</li>
        <li>Your public page URL stops working for fans — new visitors see it as unavailable.</li>
        <li>Fans can no longer buy your music, including through any embed widgets or share links out there.</li>
        <li>Fans who already bought your music keep their downloads — nothing is taken back.</li>
        <li>Your account, bio, tracks, gallery, and Stripe payout setup are untouched — nothing is deleted.</li>
        <li>You can undo this and come back anytime, right from this page.</li>
      </ul>
      {error && <p className="font-mono text-xs text-rust">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleToggle(false)}
          disabled={isPending}
          className="font-mono text-xs px-3 py-1.5 rounded bg-rust text-ink font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Hiding your page…" : "Yes, hide my artist page"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:bg-paper/10 disabled:opacity-50"
        >
          Never mind
        </button>
      </div>
    </div>
  );
}
