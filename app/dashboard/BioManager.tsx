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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const previewUrl = photoFile
    ? URL.createObjectURL(photoFile)
    : removePhoto
      ? null
      : bioPhotoUrl;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      // Photo upload stays a direct client->storage call (server actions
      // don't take File objects well) — everything else (including the
      // actual bio text write) goes through updateBio(). Same split as
      // track cover art in app/dashboard/TrackList.tsx.
      let bioPhotoUploadedUrl: string | null = null;
      if (photoFile) {
        const supabase = createClient();
        const photoPath = `${artistId}/${Date.now()}-${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("artist-photos")
          .upload(photoPath, photoFile);
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
        bioPhotoUploadedUrl = supabase.storage.from("artist-photos").getPublicUrl(photoPath).data
          .publicUrl;
      }

      const formData = new FormData();
      formData.set("bio", bioText);
      if (bioPhotoUploadedUrl) formData.set("bioPhotoUrl", bioPhotoUploadedUrl);
      if (removePhoto && !bioPhotoUploadedUrl) formData.set("removePhoto", "true");

      const result = await updateBio(formData);
      if (result.error) throw new Error(result.error);

      setPhotoFile(null);
      setRemovePhoto(false);
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
            onChange={(e) => {
              setPhotoFile(e.target.files?.[0] ?? null);
              setRemovePhoto(false);
            }}
            className="text-paper font-mono text-xs"
          />
          {previewUrl && (
            <button
              type="button"
              onClick={() => {
                setPhotoFile(null);
                setRemovePhoto(true);
              }}
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
