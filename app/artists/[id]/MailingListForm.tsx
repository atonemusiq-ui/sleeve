"use client";

import { useState } from "react";
import { joinMailingList } from "@/app/actions/artistHub";

export default function MailingListForm({ artistId, artistName }: { artistId: string; artistName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  async function handleSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    formData.set("artistId", artistId);

    const result = await joinMailingList(formData);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setJoined(true);
  }

  if (joined) {
    return (
      <p className="font-mono text-xs text-forest">
        You&apos;re on the list — {artistName} will reach out at the email you gave.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="email"
        name="fanEmail"
        required
        placeholder="your@email.com"
        className="flex-1 bg-paper/5 border border-paper/20 rounded px-3 py-1.5 text-paper font-mono text-xs"
      />
      <button
        type="submit"
        disabled={busy}
        className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50 flex-shrink-0"
      >
        {busy ? "Joining…" : "Join mailing list"}
      </button>
      {error && <p className="font-mono text-xs text-rust sm:self-center">{error}</p>}
    </form>
  );
}
