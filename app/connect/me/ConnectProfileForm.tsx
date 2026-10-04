"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveConnectProfile } from "@/app/actions/connect";
import { CONNECT_ROLES, CONNECT_ROLE_GROUPS, MAX_CONNECT_ROLES } from "@/lib/connectRoles";
import { GENRES } from "@/lib/genres";

type Profile = {
  headline: string | null;
  roles: string[];
  genres: string[];
  rate_text: string | null;
  location: string | null;
  remote: boolean;
  sample_url: string | null;
  available: boolean;
} | null;

export default function ConnectProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>(profile?.roles ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleRole(key: string) {
    setRoles((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : prev.length >= MAX_CONNECT_ROLES ? prev : [...prev, key]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await saveConnectProfile(new FormData(e.currentTarget));
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  const input = "w-full bg-ink border border-paper/25 rounded-lg px-3 py-2.5 text-paper";
  const genres = GENRES.filter((g) => g !== "Covers" && g !== "Other");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 border border-paper/15 rounded-lg p-5">
      {error && <p className="font-mono text-sm text-rust">{error}</p>}
      {saved && <p className="font-mono text-sm text-forest">Saved. People can now find you on Connect.</p>}

      <fieldset className="flex flex-col gap-3">
        <legend className="font-mono text-xs text-paper/60 mb-1">
          What do you do? Pick up to {MAX_CONNECT_ROLES} ({roles.length} picked)
        </legend>
        {CONNECT_ROLE_GROUPS.map((g) => (
          <div key={g.key} className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-paper/45">{g.label}</span>
            <div className="flex flex-wrap gap-2">
              {CONNECT_ROLES.filter((r) => r.group === g.key).map((r) => {
                const on = roles.includes(r.key);
                const full = !on && roles.length >= MAX_CONNECT_ROLES;
                return (
                  <label
                    key={r.key}
                    className={`cursor-pointer min-h-[40px] px-3 rounded-full border flex items-center gap-2 font-mono text-xs ${
                      on ? "bg-paper text-ink border-paper" : full ? "border-paper/10 text-paper/30" : "border-paper/25 hover:border-gold/60"
                    }`}
                  >
                    <input type="checkbox" name="roles" value={r.key} checked={on} disabled={full} onChange={() => toggleRole(r.key)} className="sr-only" />
                    {r.label}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
        Headline
        <input name="headline" maxLength={120} defaultValue={profile?.headline ?? ""} placeholder="Gospel keys player, 15 years in the studio" className={input} />
      </label>

      <fieldset>
        <legend className="font-mono text-xs text-paper/60 mb-2">Genres you work in (up to 5)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {genres.map((g) => (
            <label key={g} className="flex items-center gap-2 font-mono text-xs text-paper/80">
              <input type="checkbox" name="genres" value={g} defaultChecked={profile?.genres?.includes(g)} className="h-4 w-4" />
              {g}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
          Starting rate (optional)
          <input name="rate" maxLength={80} defaultValue={profile?.rate_text ?? ""} placeholder="From $150 per song" className={input} />
        </label>
        <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
          City or region (optional)
          <input name="location" maxLength={80} defaultValue={profile?.location ?? ""} placeholder="Los Angeles, CA" className={input} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
        Portfolio or sample link (optional)
        <input name="sampleUrl" type="url" maxLength={500} defaultValue={profile?.sample_url ?? ""} placeholder="https://" className={input} />
      </label>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 font-mono text-xs text-paper/80">
          <input type="checkbox" name="remote" defaultChecked={profile?.remote ?? true} className="h-4 w-4" />
          I work remotely
        </label>
        <label className="flex items-center gap-2 font-mono text-xs text-paper/80">
          <input type="checkbox" name="available" defaultChecked={profile?.available ?? true} className="h-4 w-4" />
          Show me in Connect search and accept requests
        </label>
      </div>

      <button type="submit" disabled={busy} className="self-start px-6 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold disabled:opacity-60">
        {busy ? "Saving…" : profile ? "Save changes" : "Join Connect"}
      </button>
    </form>
  );
}
