"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    // The recovery link Supabase emailed puts the session tokens in the URL
    // hash fragment, which only the browser ever sees — the client here
    // (createBrowserClient, detectSessionInUrl on by default) already
    // picked that up on page load and established a temporary "recovery"
    // session. updateUser() just needs that session to be active, which is
    // why this runs client-side rather than as a server action.
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-gold mb-8">Set a new password</h1>

      {done ? (
        <p className="font-mono text-sm text-forest">
          Password updated — taking you to log in...
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="font-mono text-sm text-rust">{error}</p>}

          <div>
            <label className="block font-mono text-xs text-paper/60 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-4 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Update password"}
          </button>
        </form>
      )}

      <p className="font-mono text-xs text-paper/50 mt-6">
        If this link has expired, request a new one from{" "}
        <a href="/forgot-password" className="text-gold">
          the reset page
        </a>
        .
      </p>
    </main>
  );
}
