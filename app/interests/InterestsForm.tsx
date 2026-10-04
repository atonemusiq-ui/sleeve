"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveInterests } from "@/app/actions/interests";
import { GENRES } from "@/lib/genres";
import { INTEREST_TAGS } from "@/lib/interests";

type Initial = { genres: string[]; tags: string[]; personalized: boolean; birthYear: number | null };

export default function InterestsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await saveInterests(new FormData(e.currentTarget));
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  const genres = GENRES.filter((g) => g !== "Covers" && g !== "Other");
  const chip = "flex items-center gap-2 font-mono text-xs text-paper/85 min-h-[36px]";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 border border-paper/15 rounded-lg p-5">
      {error && <p className="font-mono text-sm text-rust">{error}</p>}
      {saved && (
        <p className="font-mono text-sm text-forest">
          Saved. Your For You feed on{" "}
          <a href="/discover" className="underline">
            Discover
          </a>{" "}
          is updated.
        </p>
      )}

      <fieldset>
        <legend className="font-display text-lg mb-2">Genres you love</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
          {genres.map((g) => (
            <label key={g} className={chip}>
              <input type="checkbox" name="genres" value={g} defaultChecked={initial.genres.includes(g)} className="h-4 w-4" />
              {g}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-lg mb-2">Your music life</legend>
        <div className="grid sm:grid-cols-2 gap-x-4">
          {INTEREST_TAGS.map((t) => (
            <label key={t.key} className={chip}>
              <input type="checkbox" name="tags" value={t.key} defaultChecked={initial.tags.includes(t.key)} className="h-4 w-4" />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60 max-w-[12rem]">
        Birth year (optional)
        <input
          type="number"
          name="birthYear"
          min={1900}
          max={new Date().getFullYear()}
          defaultValue={initial.birthYear ?? ""}
          className="bg-ink border border-paper/25 rounded-lg px-3 py-2.5 text-paper"
        />
        <span className="text-paper/45">Members under 18 never see targeted offers.</span>
      </label>

      <label className="flex items-start gap-2 font-mono text-xs text-paper/85">
        <input type="checkbox" name="personalized" defaultChecked={initial.personalized} className="h-4 w-4 mt-0.5" />
        <span>
          Personalize my recommendations. Turn this off and For You only shows artists you follow or have bought from.
        </span>
      </label>

      <button type="submit" disabled={busy} className="self-start px-6 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold disabled:opacity-60">
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
