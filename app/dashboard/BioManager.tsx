"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateBio } from "@/app/actions/artist";

export default function BioManager({
  artistId,
  bio,
  bioPhotoUrl,
}: {
  artistId: string;
  bio: string | null;
  bioPhotoUrl: string | null;
}) {
  const [bioText, setBioText] = useState(bio ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const previewUrl = photoFile
    ? URL.createObjectURL(photoFile)
    : removePhoto
      ? null
      : bioPhotoUrl;

  // Picking a photo saves it immediately, rather than staging it locally
  // until the separate "Save bio" button is clicked below — previously a
  // chosen photo only existed as an in-memory preview until that click, so
  // navigating away right after picking one lost it, which looked like the
  // photo "disappearing" even though nothing had actually failed.
  async function handlePhotoChange(file: File | null) {
    if (!file) return;
    setError(null);
    setPhotoFile(file);
    setRemovePhoto(false);
    setPhotoBusy(true);

    try {
      const supabase = createClient();
      const photoPath = `${artistId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("artist-photos")
        .upload(photoPath, file);
      if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
      const uploadedUrl = supabase.storage.from("artist-photos").getPublicUrl(photoPath).data
        .publicUrl;

      const formData = new FormData();
      formData.set("bio", bioText);
      formData.set("bioPhotoUrl", uploadedUrl);
      const result = await updateBio(formData);
      if (result.error) throw new Error(result.error);

      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setPhotoFile(null);
    } finally {
      setPhotoBusy(false);
    }
  }

  // Same idea as above — removing a photo takes effect right away instead
  // of waiting for "Save bio".
  async function handleRemovePhoto() {
    setError(null);
    setPhotoBusy(true);

    try {
      const formData = new FormData();
      formData.set("bio", bioText);
      formData.set("removePhoto", "true");
      const result = await updateBio(formData);
      if (result.error) throw new Error(result.error);

      setPhotoFile(null);
      setRemovePhoto(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setPhotoBusy(false);
    }
  }

  // The bio text keeps its own explicit Save — only the photo needed to
  // become instant, since a half-typed bio shouldn't autosave on every
  // keystroke. Sending only "bio" here (no bioPhotoUrl/removePhoto) leaves
  // the photo exactly as it is; see app/actions/artist.ts's updateBio.
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const formData = new FormData();
      formData.set("bio", bioText);

      const result = await updateBio(formData);
      if (result.error) throw new Error(result.error);

      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3">
      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-paper/10 flex-shrink-0 overflow-hidden border border-paper/15">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-paper/30 text-xl">
              ♪
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <input
            type="file"
            accept="image/*"
            disabled={photoBusy}
            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
            className="text-paper font-mono text-xs disabled:opacity-50"
          />
          {photoBusy && <p className="font-mono text-xs text-paper/50">Saving photo...</p>}
          {!photoBusy && previewUrl && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="self-start font-mono text-xs text-rust hover:underline"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      <textarea
        name="bio"
        value={bioText}
        onChange={(e) => setBioText(e.target.value)}
        rows={4}
        placeholder="Tell fans a bit about yourself..."
        className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
      />

      <button
        type="submit"
        disabled={busy}
        className="self-start font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save bio"}
      </button>
    </form>
  );
}
