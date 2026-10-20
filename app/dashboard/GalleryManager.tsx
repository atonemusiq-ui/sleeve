"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateGallery } from "@/app/actions/artist";

const SLOT_COUNT = 4;

// A fixed 4-photo gallery shown on the public artist page
// (app/artists/[id]/page.tsx) — press-kit-style photos beyond the single
// circular bio photo (BioManager.tsx). Each photo has its own Add/Replace and
// Remove button, and every change saves right away (same as the bio photo):
// a new photo uploads to the public "artist-photos" bucket, then the full
// list of URLs is written in one call.
export default function GalleryManager({
  artistId,
  galleryUrls,
}: {
  artistId: string;
  galleryUrls: string[];
}) {
  const [urls, setUrls] = useState<(string | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) => galleryUrls[i] ?? null)
  );
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save(next: (string | null)[], slot: number) {
    setError(null);
    setBusySlot(slot);
    try {
      const formData = new FormData();
      formData.set("galleryUrls", JSON.stringify(next.filter(Boolean)));
      const result = await updateGallery(formData);
      if (result.error) throw new Error(result.error);
      // Saved photos close up any gaps, same order as on the artist page.
      const compact = next.filter(Boolean) as string[];
      setUrls(Array.from({ length: SLOT_COUNT }, (_, i) => compact[i] ?? null));
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusySlot(null);
    }
  }

  async function replace(slot: number, file: File | null) {
    if (!file) return;
    setError(null);
    setBusySlot(slot);
    const supabase = createClient();
    const path = `${artistId}/gallery-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("artist-photos").upload(path, file);
    if (uploadError) {
      setError(`Photo upload failed: ${uploadError.message}`);
      setBusySlot(null);
      return;
    }
    const url = supabase.storage.from("artist-photos").getPublicUrl(path).data.publicUrl;
    await save(urls.map((u, i) => (i === slot ? url : u)), slot);
  }

  async function remove(slot: number) {
    if (!window.confirm("Remove this photo from your artist page?")) return;
    await save(urls.map((u, i) => (i === slot ? null : u)), slot);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {urls.map((url, i) => {
          const busy = busySlot === i;
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="aspect-square rounded-lg bg-paper/10 overflow-hidden border border-dashed border-paper/25 flex items-center justify-center">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className={`w-full h-full object-cover ${busy ? "opacity-40" : ""}`} />
                ) : (
                  <span className="font-mono text-[10px] text-paper/50 text-center px-2">
                    {busy ? "Saving..." : "Empty"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label
                  className={`font-mono text-[11px] px-2 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10 cursor-pointer ${
                    busySlot !== null ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {busy ? "Saving..." : url ? "📷 Replace" : "📷 Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={busySlot !== null}
                    onChange={(e) => {
                      replace(i, e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                    className="sr-only"
                  />
                </label>
                {url && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={busySlot !== null}
                    className="font-mono text-[11px] text-rust hover:underline disabled:opacity-50"
                  >
                    🗑 Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="font-mono text-[11px] text-paper/40">Changes save right away.</p>
    </div>
  );
}
