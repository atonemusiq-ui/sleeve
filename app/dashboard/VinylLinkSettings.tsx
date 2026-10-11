"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateVinylLink } from "@/app/actions/vinyl";

// Per-track "Get it on Vinyl" link in the artist's catalog (TrackList.tsx).
// The artist sets up the pressing with an on-demand vinyl service, then
// pastes that page's link here; fans see a button on the artist page.
export default function VinylLinkSettings({ trackId, vinylUrl }: { trackId: string; vinylUrl: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(vinylUrl));
  const [value, setValue] = useState(vinylUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("trackId", trackId);
    fd.set("vinylUrl", value);
    const result = await updateVinylLink(fd);
    setBusy(false);
    if (result.error) {
      setMessage({ ok: false, text: result.error });
    } else {
      setMessage({
        ok: true,
        text: value.trim() ? "Your vinyl button is live on your artist page." : "Vinyl link removed.",
      });
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start font-mono text-xs px-2 py-1 rounded border border-flame/40 text-flame hover:bg-flame/10"
      >
        💿 Add a vinyl link
      </button>
    );
  }

  return (
    <div className="border border-flame/30 bg-flame/5 rounded px-3 py-3 flex flex-col gap-2">
      <label className="font-mono text-xs text-paper/80" htmlFor={`${trackId}-vinyl`}>
        💿 Get it on Vinyl
      </label>
      <p className="font-mono text-[11px] text-paper/50">
        Set up an on-demand pressing (for example on{" "}
        <a href="https://elasticstage.com" target="_blank" rel="noopener noreferrer" className="text-gold underline">
          elasticStage
        </a>
        ), then paste your record&apos;s page link here. Fans buy the record there; leave it blank to remove the
        button.
      </p>
      <input
        id={`${trackId}-vinyl`}
        type="url"
        inputMode="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://..."
        className="bg-ink border border-paper/20 rounded px-2 py-1 text-paper font-mono text-xs"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save vinyl link"}
        </button>
        {!vinylUrl && (
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
