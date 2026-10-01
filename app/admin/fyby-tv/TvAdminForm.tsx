"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addTvVideo } from "@/app/actions/fybyTv";
import { MAX_TV_DESCRIPTION_LENGTH, MAX_TV_TITLE_LENGTH } from "@/lib/fybyTv";

const input = "w-full bg-ink border border-paper/20 rounded px-3 py-2 text-paper font-mono text-sm";

export default function TvAdminForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const result = await addTvVideo(formData);
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    formRef.current?.reset();
    setMessage("Added. It's on the homepage now.");
    router.refresh();
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 border border-paper/15 rounded-lg p-5 bg-paper/5">
      <h2 className="font-display text-lg">Add a video</h2>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
        <select name="category" className={input} defaultValue="whats_new">
          <option value="whats_new">What&apos;s New (features, announcements)</option>
          <option value="how_to">How-To (tutorials, marketing tips)</option>
        </select>
        <input name="sortOrder" type="number" placeholder="Order" defaultValue={0} className={input} aria-label="Order" />
      </div>
      <input name="title" required maxLength={MAX_TV_TITLE_LENGTH} placeholder="Title" className={input} />
      <textarea
        name="description"
        rows={2}
        maxLength={MAX_TV_DESCRIPTION_LENGTH}
        placeholder="Short description (optional)"
        className={input}
      />
      <input name="videoUrl" required placeholder="YouTube or Vimeo link" className={input} />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-sm px-4 py-2 rounded bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add to Fyby TV"}
        </button>
        {message && <span className="font-mono text-xs text-paper/70">{message}</span>}
      </div>
    </form>
  );
}
