"use client";
import { generatePreviewClip } from "@/lib/generatePreviewClip";


import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function UploadForm({ artistId }: { artistId: string }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("5.00");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!audioFile) {
      setError("Please choose an audio file.");
      return;
    }

    const priceCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      setError("Please enter a valid price.");
      return;
    }

    setUploading(true);
    const supabase = createClient();

    try {
      // Upload audio into the private "track-audio" bucket — we store the
      // storage *path*, not a URL, since there's no public URL to have. The
      // track only becomes playable via a signed URL minted after a
      // verified purchase (see app/success/page.tsx) or for the owning
      // artist (see app/dashboard/page.tsx). Path convention:
      // <artist_id>/<timestamp>-<filename>, matched by the storage RLS
      // policies in supabase/schema.sql.
      const audioPath = `${artistId}/${Date.now()}-${audioFile.name}`;
      const { error: audioError } = await supabase.storage
        .from("track-audio")
        .upload(audioPath, audioFile);

      if (audioError) throw new Error(`Audio upload failed: ${audioError.message}`);

      let previewUrl: string | null = null;
      try {
        const previewBlob = await generatePreviewClip(audioFile);
        const previewPath = `${artistId}/${Date.now()}-preview.wav`;
        const { error: previewError } = await supabase.storage
          .from("track-previews")
          .upload(previewPath, previewBlob);

        if (previewError) {
          console.error("Preview upload failed:", previewError.message);
        } else {
          previewUrl = 
supabase.storage.from("track-previews").getPublicUrl(previewPath).data.publicUrl;
        }
      } catch (previewErr) {
        console.error("Preview clip generation failed:", previewErr);
      }


      // Cover art goes in the separate *public* "track-covers" bucket — fine
      // to serve directly, unlike the paid audio.
      let coverUrl: string | null = null;
      if (coverFile) {
        const coverPath = `${artistId}/${Date.now()}-${coverFile.name}`;
        const { error: coverError } = await supabase.storage
          .from("track-covers")
          .upload(coverPath, coverFile);

        if (coverError) throw new Error(`Cover upload failed: ${coverError.message}`);

        coverUrl = supabase.storage.from("track-covers").getPublicUrl(coverPath).data.publicUrl;
      }

      // Insert the track row
      const { error: insertError } = await supabase.from("tracks").insert({
        artist_id: artistId,
        title,
        price_cents: priceCents,
        audio_path: audioPath,
        cover_url: coverUrl,
        preview_url: previewUrl,
      });

      if (insertError) throw new Error(`Saving track failed: ${insertError.message}`);

      setTitle("");
      setPrice("5.00");
      setAudioFile(null);
      setCoverFile(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-paper/15 rounded-lg p-6 mb-10 flex flex-col gap-4"
    >
      <h2 className="font-display text-xl">Publish a track</h2>

      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
        />
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">Price (USD)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
        />
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">Audio file (mp3, wav)</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
          required
          className="w-full text-paper font-mono text-sm"
        />
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">
          Cover art (optional)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          className="w-full text-paper font-mono text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="mt-2 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90 disabled:opacity-50"
      >
        {uploading ? "Publishing..." : "Publish"}
      </button>
    </form>
  );
}
