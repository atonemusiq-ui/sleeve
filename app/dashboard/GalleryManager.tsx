"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateGallery } from "@/app/actions/artist";

const SLOT_COUNT = 4;

type Slot = { existingUrl: string | null; file: File | null; removed: boolean };

// A fixed 4-photo gallery shown on the public artist page
// (app/artists/[id]/page.tsx) — press-kit-style photos beyond the single
// circular bio photo (BioManager.tsx). Each slot works the same way: pick a
// photo (or leave it as the dashed "Upload your artwork here" box), Save
// uploads whatever's new to the same public "artist-photos" bucket the bio
// photo uses and writes the resulting URLs as one array.
export default function GalleryManager({
  artistId,
  galleryUrls,
}: {
  artistId: string;
  galleryUrls: string[];
}) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) => ({
      existingUrl: galleryUrls[i] ?? null,
      file: null,
      removed: false,
    }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function previewFor(slot: Slot): string | null {
    if (slot.file) return URL.createObjectURL(slot.file);
    if (slot.removed) return null;
    return slot.existingUrl;
  }

  function setSlotFile(index: number, file: File | null) {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, file, removed: false } : s))
    );
  }

  function removeSlot(index: number) {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, file: null, removed: true } : s))
    );
  }

  async function handleSave() {
    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const finalUrls: string[] = [];

      for (const slot of slots) {
        if (slot.file) {
          const path = `${artistId}/gallery-${Date.now()}-${slot.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("artist-photos")
            .upload(path, slot.file);
          if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
          finalUrls.push(supabase.storage.from("artist-photos").getPublicUrl(path).data.publicUrl);
        } else if (!slot.removed && slot.existingUrl) {
          finalUrls.push(slot.existingUrl);
        }
      }

      const formData = new FormData();
      formData.set("galleryUrls", JSON.stringify(finalUrls));

      const result = await updateGallery(formData);
      if (result.error) throw new Error(result.error);

      setSlots(
        Array.from({ length: SLOT_COUNT }, (_, i) => ({
          existingUrl: finalUrls[i] ?? null,
          file: null,
          removed: false,
        }))
      );
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {slots.map((slot, i) => {
          const preview = previewFor(slot);
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="aspect-square rounded-lg bg-paper/10 overflow-hidden border border-dashed border-paper/25 flex items-center justify-center">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-mono text-[10px] text-paper/50 text-center px-2">
                    Upload your artwork here
                  </span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSlotFile(i, e.target.files?.[0] ?? null)}
                className="w-full text-paper font-mono text-[11px] file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-gold file:text-ink file:font-mono file:text-[11px] file:font-medium file:cursor-pointer hover:file:opacity-90"
              />
              {preview && (
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  className="self-start font-mono text-[11px] text-rust hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="self-start font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save gallery"}
      </button>
    </div>
  );
}
