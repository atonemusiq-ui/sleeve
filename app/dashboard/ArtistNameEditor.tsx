"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName } from "@/app/actions/profile";

// Shows the artist's name with an ✏️ Edit button; editing swaps in a text
// field with Save / Cancel. Used in the Artist Studio header and in the
// "Name, profile photo & bio" section.
export default function ArtistNameEditor({
  name,
  className = "",
  size = "sm",
}: {
  name: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [current, setCurrent] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("displayName", value);
    const result = await updateDisplayName(fd);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCurrent(result.name ?? value);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className={size === "lg" ? "font-display text-xl" : "font-mono text-sm text-paper/60"}>{current}</span>
        <button
          type="button"
          onClick={() => {
            setValue(current);
            setEditing(true);
          }}
          className="font-mono text-[11px] px-2 py-0.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
        >
          ✏️ Edit name
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="font-mono text-[11px] text-paper/50" htmlFor="artist-display-name">
        Artist name (shown on your page, the storefront and fans&apos; receipts)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="artist-display-name"
          value={value}
          maxLength={60}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="bg-paper/5 border border-paper/20 rounded px-3 py-1.5 text-paper font-body text-sm min-w-[14rem]"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          className="font-mono text-xs text-paper/50 hover:text-paper"
        >
          Cancel
        </button>
      </div>
      {error && <p className="font-mono text-xs text-rust">{error}</p>}
    </div>
  );
}
