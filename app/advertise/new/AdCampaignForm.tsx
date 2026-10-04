"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { estimateAdReach, startAdCampaign } from "@/app/actions/ads";
import { GENRES } from "@/lib/genres";
import { INTEREST_TAGS } from "@/lib/interests";
import { CONNECT_ROLES } from "@/lib/connectRoles";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function AdCampaignForm({ userId }: { userId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [brand, setBrand] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [budget, setBudget] = useState("100");
  const [reach, setReach] = useState<{ reach: number | null; views: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = file ? URL.createObjectURL(file) : null;

  async function refreshReach() {
    if (!formRef.current) return;
    try {
      setReach(await estimateAdReach(new FormData(formRef.current)));
    } catch {
      /* estimate is a nice-to-have */
    }
  }

  useEffect(() => {
    refreshReach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (file && file.size > MAX_IMAGE_BYTES) return setError("Image is too big (max 5 MB).");
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (file) {
        const supabase = createClient();
        const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
        const path = `${userId}/ad-${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("ad-creatives").upload(path, file);
        if (upErr) throw new Error(`Image upload failed: ${upErr.message}`);
        fd.set("imageUrl", supabase.storage.from("ad-creatives").getPublicUrl(path).data.publicUrl);
      }
      const result = await startAdCampaign(fd);
      if ("error" in result) throw new Error(result.error);
      window.location.href = result.url;
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setBusy(false);
    }
  }

  const input = "w-full bg-ink border border-paper/25 rounded-lg px-3 py-2.5 text-paper";
  const chip = "flex items-center gap-2 font-mono text-xs text-paper/85 min-h-[32px]";

  return (
    <form ref={formRef} onSubmit={handleSubmit} onChange={refreshReach} className="grid md:grid-cols-[1fr_300px] gap-8">
      <div className="flex flex-col gap-6">
        {error && <p className="font-mono text-sm text-rust">{error}</p>}

        <fieldset className="flex flex-col gap-4 border border-paper/15 rounded-lg p-5">
          <legend className="font-display text-lg px-1">Your card</legend>
          <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
            Brand name
            <input name="brandName" required maxLength={60} value={brand} onChange={(e) => setBrand(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
            Headline
            <input name="headline" required maxLength={80} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="20% off strings this month" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
            One line of detail (optional)
            <input name="body" maxLength={160} value={body} onChange={(e) => setBody(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
            Link (https://)
            <input name="clickUrl" type="url" required maxLength={500} placeholder="https://" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60">
            Square image (optional, PNG or JPG, up to 5 MB)
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-paper text-xs file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:bg-gold file:text-ink file:font-mono file:cursor-pointer"
            />
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-4 border border-paper/15 rounded-lg p-5">
          <legend className="font-display text-lg px-1">Who should see it?</legend>
          <p className="font-mono text-[11px] text-paper/55">Leave everything unchecked to show it to everyone on Fyby.</p>
          <div>
            <p className="font-mono text-xs text-paper/60 mb-1">Fans of</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
              {GENRES.filter((g) => g !== "Covers" && g !== "Other").map((g) => (
                <label key={g} className={chip}>
                  <input type="checkbox" name="genres" value={g} className="h-4 w-4" />
                  {g}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-xs text-paper/60 mb-1">People who said</p>
            <div className="grid sm:grid-cols-2 gap-x-4">
              {INTEREST_TAGS.map((t) => (
                <label key={t.key} className={chip}>
                  <input type="checkbox" name="tags" value={t.key} className="h-4 w-4" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-xs text-paper/60 mb-1">Musicians and creatives on Fyby Connect</p>
            <div className="grid sm:grid-cols-2 gap-x-4">
              {CONNECT_ROLES.map((r) => (
                <label key={r.key} className={chip}>
                  <input type="checkbox" name="roles" value={r.key} className="h-4 w-4" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 font-mono text-xs text-paper/60 max-w-[14rem]">
          Budget (USD)
          <input name="budget" type="number" min={100} max={10000} step={1} value={budget} onChange={(e) => setBudget(e.target.value)} className={input} />
          <span className="text-paper/45">$10 per 1,000 views · $100 minimum</span>
        </label>
      </div>

      <aside className="flex flex-col gap-4 md:sticky md:top-6 self-start">
        <p className="font-mono text-[11px] uppercase tracking-widest text-paper/50">Preview</p>
        <div className="rounded-2xl border border-paper/15 bg-ink/60 p-4 flex gap-3 items-center">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-paper/50">Sponsored · {brand || "Your brand"}</p>
            <p className="font-semibold leading-snug">{headline || "Your headline"}</p>
            {body && <p className="text-paper/70 text-sm">{body}</p>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-y-1 font-mono text-xs">
          <dt className="text-paper/60">Views you get</dt>
          <dd className="text-right">{reach ? reach.views.toLocaleString("en-US") : "—"}</dd>
          <dt className="text-paper/60">Estimated reach</dt>
          <dd className="text-right">{reach ? (reach.reach === null ? "Under 100 people" : `${reach.reach.toLocaleString("en-US")} people`) : "—"}</dd>
        </dl>
        <p className="font-mono text-[11px] text-paper/45">
          Reach counts adults who left personalization on and match your picks. Cards also show on artist pages that
          match your genres.
        </p>
        <button type="submit" disabled={busy} className="px-6 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold disabled:opacity-60">
          {busy ? "Opening payment…" : `Pay $${Number(budget || 0).toFixed(0)} and submit`}
        </button>
        <p className="font-mono text-[11px] text-paper/45">Refunded in full if your ad isn&apos;t approved.</p>
      </aside>
    </form>
  );
}
