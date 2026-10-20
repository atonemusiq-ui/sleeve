"use client";

import { useState } from "react";
import { joinMailingList } from "@/app/actions/artistHub";
import { useT } from "@/app/I18nProvider";

export default function MailingListForm({
  artistId,
  artistName,
  defaultEmail = "",
}: {
  artistId: string;
  artistName: string;
  // Pre-filled after a purchase (app/success/page.tsx) with the checkout email.
  defaultEmail?: string;
}) {
  const [busy, setBusy] = useState(false);
  const t = useT();
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
        {t("mailing.joined", { name: artistName })}
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="email"
        name="fanEmail"
        required
        defaultValue={defaultEmail}
        placeholder="your@email.com"
        className="flex-1 bg-paper/5 border border-paper/20 rounded px-3 py-1.5 text-paper font-mono text-xs"
      />
      <button
        type="submit"
        disabled={busy}
        className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50 flex-shrink-0"
      >
        {busy ? t("mailing.joining") : t("mailing.join")}
      </button>
      {error && <p className="font-mono text-xs text-rust sm:self-center">{error}</p>}
    </form>
  );
}
