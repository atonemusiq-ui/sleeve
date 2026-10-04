"use client";

import { useState } from "react";
import { sendConnectRequest } from "@/app/actions/connect";
import { connectRoleLabel } from "@/lib/connectRoles";

export default function ConnectRequestForm({ toUser, name, roles }: { toUser: string; name: string; roles: string[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await sendConnectRequest(new FormData(e.currentTarget));
    setBusy(false);
    if (result.error) setError(result.error);
    else setSent(true);
  }

  if (sent) {
    return (
      <p className="font-mono text-sm text-forest">
        Request sent. {name} will see it in their Connect inbox and can reply to your email.
      </p>
    );
  }

  const input = "w-full bg-ink border border-paper/25 rounded-lg px-3 py-2.5 text-paper";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="toUser" value={toUser} />
      {error && <p className="font-mono text-sm text-rust">{error}</p>}

      <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
        I need a…
        <select name="role" required className={input} defaultValue={roles[0]}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {connectRoleLabel(r)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
          Budget (optional)
          <input name="budget" maxLength={80} placeholder="e.g. $200 or a song split" className={input} />
        </label>
        <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
          Needed by (optional)
          <input type="date" name="deadline" className={input} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
        About the project
        <textarea name="message" required maxLength={2000} rows={5} placeholder="What's the song, the vibe, and what you need?" className={input} />
      </label>

      <p className="font-mono text-[11px] text-paper/50">Your account email is shared with {name} so they can reply.</p>

      <button type="submit" disabled={busy} className="self-start px-6 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold disabled:opacity-60">
        {busy ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
