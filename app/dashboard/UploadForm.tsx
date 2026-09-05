"use client";
import { generatePreviewClip } from "@/lib/generatePreviewClip";
import { generateAudioFingerprint } from "@/lib/fingerprint/generateFingerprint";
import { publishTrack } from "@/app/actions/upload";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Fixed price menu — matches ALLOWED_TRACK_PRICE_CENTS in
// app/actions/tracks.ts, which is what actually enforces this server-side.
const TRACK_PRICE_OPTIONS = ["3.00", "4.00", "5.00"];

export default function UploadForm({ artistId }: { artistId: string }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("5.00");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<number | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFlagged(null);

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
      // Fingerprint the file up front, before any storage upload — if it
      // turns out to be a duplicate, publishTrack() below will flag it
      // instead of inserting a track row, but we still needed the audio
      // file uploaded so the artist (and, on the admin review page, a human
      // reviewer) can actually listen to what got flagged.
      let fingerprint = "";
      let fingerprintDuration = 0;
      try {
        const result = await generateAudioFingerprint(audioFile);
        fingerprint = result.fingerprint;
        fingerprintDuration = result.durationSeconds;
      } catch (fingerprintErr) {
        console.error("Fingerprint generation failed:", fingerprintErr);
        // Fall through with an empty fingerprint — publishTrack() will just
        // publish without a duplicate check rather than block a legitimate
        // upload over a client-side analysis failure (e.g. an unsupported
        // codec Web Audio can't decode for analysis but Supabase Storage is
        // happy to store).
      }

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
          previewUrl = supabase.storage.from("track-previews").getPublicUrl(previewPath).data.publicUrl;
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

      // The actual `tracks` row insert happens server-side in publishTrack()
      // so the duplicate-fingerprint check can't be bypassed by a client
      // that just skips calling it.
      const result = await publishTrack({
        artistId,
        title,
        priceCents,
        audioPath,
        coverUrl,
        previewUrl,
        fingerprint,
        fingerprintDuration,
      });

      if (result.status === "error") {
        throw new Error(result.message);
      }

      if (result.status === "flagged") {
        setFlagged(result.similarity);
        setUploading(false);
        return;
      }

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

      {flagged !== null && (
        <p className="text-rust font-mono text-sm">
          This looks very similar to a track already on Fyby ({Math.round(flagged * 100)}% match) —
          it's been held for review instead of published. If this is a mistake (a re-upload of your
          own track, a false positive), reach out and we'll sort it out.
        </p>
      )}

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
        <select
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
        >
          {TRACK_PRICE_OPTIONS.map((option) => (
            <option key={option} value={option} className="bg-ink text-paper">
              ${option}
            </option>
          ))}
        </select>
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
