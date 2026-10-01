"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLicenseSettings } from "@/app/actions/licensing";
import { LICENSE_TIERS, LICENSE_TIER_ORDER, type LicenseTier } from "@/lib/licensing";

// Per-track licensing controls in the artist's catalog (TrackList.tsx):
// turn licensing on, set a price for each tier the artist wants to offer.
export default function LicenseSettings({
  trackId,
  enabled,
  prices,
}: {
  trackId: string;
  enabled: boolean;
  prices: Record<LicenseTier, number | null>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(enabled);
  const [on, setOn] = useState(enabled);
  const [values, setValues] = useState<Record<LicenseTier, string>>(() => {
    const v = {} as Record<LicenseTier, string>;
    for (const tier of LICENSE_TIER_ORDER) {
      v[tier] = prices[tier] != null ? ((prices[tier] as number) / 100).toFixed(2).replace(/\.00$/, "") : "";
    }
    return v;
  });
  const [attested, setAttested] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("trackId", trackId);
    fd.set("enabled", on ? "true" : "false");
    for (const tier of LICENSE_TIER_ORDER) fd.set(tier, values[tier]);
    if (attested) fd.set("rightsAttested", "on");
    const result = await updateLicenseSettings(fd);
    setBusy(false);
    if (result.error) {
      setMessage({ ok: false, text: result.error });
    } else {
      setMessage({ ok: true, text: on ? "Licensing is live on your artist page." : "Licensing turned off." });
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start font-mono text-xs px-2 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10"
      >
        💼 Sell licenses for this song
      </button>
    );
  }

  return (
    <div className="border border-gold/30 bg-gold/5 rounded px-3 py-3 flex flex-col gap-3">
      <label className="flex items-center gap-2 font-mono text-xs text-paper/80">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        💼 Sell licenses for this song (beat leases and sync for video, film and ads)
      </label>

      {on && (
        <>
          <p className="font-mono text-xs text-paper/50">
            Set a price for each license you want to offer; leave one blank to skip it. Every license is
            non-exclusive — you keep the song. Payouts work like sales, and your contributors get their split.
          </p>
          <div className="flex flex-col gap-2">
            {LICENSE_TIER_ORDER.map((tier) => (
              <div key={tier} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <label className="font-mono text-xs text-paper/80 sm:w-44 flex-shrink-0" htmlFor={`${trackId}-${tier}`}>
                  {LICENSE_TIERS[tier].label}
                </label>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs text-paper/50">$</span>
                  <input
                    id={`${trackId}-${tier}`}
                    inputMode="decimal"
                    value={values[tier]}
                    onChange={(e) => setValues((v) => ({ ...v, [tier]: e.target.value }))}
                    placeholder={`e.g. ${(LICENSE_TIERS[tier].suggestedCents / 100).toFixed(0)}`}
                    className="w-28 bg-ink border border-paper/20 rounded px-2 py-1 text-paper font-mono text-xs"
                  />
                </div>
                <span className="font-mono text-[11px] text-paper/40">{LICENSE_TIERS[tier].summary}</span>
              </div>
            ))}
          </div>
          <label className="flex items-start gap-2 font-mono text-xs text-paper/70">
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5" />
            <span>
              I control the rights to license this song, including the recording and the composition, and
              everyone credited on it has agreed. See the{" "}
              <a href="/licenses/terms" target="_blank" className="text-gold underline">
                license terms
              </a>{" "}
              buyers agree to.
            </span>
          </label>
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save licensing"}
        </button>
        {!enabled && !on && (
          <button type="button" onClick={() => setOpen(false)} className="font-mono text-xs text-paper/50 hover:text-paper">
            Cancel
          </button>
        )}
        {message && (
          <span className={`font-mono text-xs ${message.ok ? "text-forest" : "text-rust"}`}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
