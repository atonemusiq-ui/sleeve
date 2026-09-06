"use client";
import { generatePreviewClip } from "@/lib/generatePreviewClip";
import { generateAudioFingerprint } from "@/lib/fingerprint/generateFingerprint";
import { publishTrack } from "@/app/actions/upload";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { GENRES, MAX_CUSTOM_TAG_LENGTH, COVERS_GENRE } from "@/lib/genres";
import { AI_DISCLOSURE_LEVELS, RIGHTS_ATTESTATION_TEXT, type AiDisclosureLevel } from "@/lib/aiDisclosure";
import { extractEmbeddedArtwork, type EmbeddedArtwork } from "@/lib/extractEmbeddedArtwork";
import { DEFAULT_TRACK_COVER_URL } from "@/lib/defaultCover";

// Fixed price menu — matches ALLOWED_TRACK_PRICE_CENTS in
// app/actions/tracks.ts, which is what actually enforces this server-side.
const TRACK_PRICE_OPTIONS = ["3.00", "4.00", "5.00"];

function extensionForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export default function UploadForm({ artistId }: { artistId: string }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("5.00");
  const [genre, setGenre] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [aiDisclosure, setAiDisclosure] = useState<AiDisclosureLevel>("human");
  const [rightsAttested, setRightsAttested] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<number | null>(null);
  // Artwork Fyby found already embedded in the audio file's own tags (see
  // lib/extractEmbeddedArtwork.ts) — offered as a one-click "use this"
  // instead of making the artist upload it again separately.
  const [embeddedArtwork, setEmbeddedArtwork] = useState<EmbeddedArtwork | null>(null);
  const [checkingArtwork, setCheckingArtwork] = useState(false);
  const router = useRouter();

  async function handleAudioChange(file: File | null) {
    setAudioFile(file);
    setEmbeddedArtwork(null);
    if (!file) return;

    setCheckingArtwork(true);
    try {
      const found = await extractEmbeddedArtwork(file);
      // Don't override artwork the artist already picked by hand.
      if (found && !coverFile) {
        setEmbeddedArtwork(found);
      }
    } finally {
      setCheckingArtwork(false);
    }
  }

  function acceptEmbeddedArtwork() {
    if (!embeddedArtwork) return;
    const ext = extensionForMime(embeddedArtwork.mimeType);
    setCoverFile(new File([embeddedArtwork.blob], `embedded-cover.${ext}`, { type: embeddedArtwork.mimeType }));
    setEmbeddedArtwork(null);
  }

  function declineEmbeddedArtwork() {
    setEmbeddedArtwork(null);
  }

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

    if (!rightsAttested) {
      setError("Please confirm you own the rights to this track before publishing.");
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
        genre: genre || null,
        customTag: customTag || null,
        aiDisclosure,
        rightsAttested,
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
      setGenre("");
      setCustomTag("");
      setAiDisclosure("human");
      setRightsAttested(false);
      setAudioFile(null);
      setCoverFile(null);
      setEmbeddedArtwork(null);
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
        <label className="block font-mono text-xs text-paper/60 mb-1">Genre (optional)</label>
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
        >
          <option value="" className="bg-ink text-paper">
            No genre
          </option>
          {GENRES.map((g) => (
            <option key={g} value={g} className="bg-ink text-paper">
              {g}
            </option>
          ))}
        </select>
        {genre === COVERS_GENRE && (
          <p className="font-mono text-xs text-rust mt-1.5">
            Covers require crediting and paying the original songwriter(s)/producer(s). Publish
            this track, then add them under Contributors on your dashboard with their royalty
            share — sales are blocked until you do.
          </p>
        )}
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">
          Your own tag (optional, one word or short phrase)
        </label>
        <input
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          maxLength={MAX_CUSTOM_TAG_LENGTH}
          placeholder="e.g. lo-fi, worship, boom bap"
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
        />
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">
          Did AI play a part in making this track?
        </label>
        <select
          value={aiDisclosure}
          onChange={(e) => setAiDisclosure(e.target.value as AiDisclosureLevel)}
          required
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
        >
          {AI_DISCLOSURE_LEVELS.map((level) => (
            <option key={level.value} value={level.value} className="bg-ink text-paper">
              {level.label}
            </option>
          ))}
        </select>
        <p className="font-mono text-xs text-paper/50 mt-1.5">
          Answering "AI-Assisted" or "Fully AI-Generated" shows that label on the storefront —
          buyers can see it before purchasing.
        </p>
      </div>

      <label className="flex items-start gap-2 font-mono text-xs text-paper/70">
        <input
          type="checkbox"
          checked={rightsAttested}
          onChange={(e) => setRightsAttested(e.target.checked)}
          required
          className="mt-0.5"
        />
        <span>{RIGHTS_ATTESTATION_TEXT}</span>
      </label>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">Audio file (mp3, wav)</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => handleAudioChange(e.target.files?.[0] ?? null)}
          required
          className="w-full text-paper font-mono text-sm file:mr-3 file:px-4 file:py-2.5 file:rounded file:border-0 file:bg-gold file:text-ink file:font-mono file:text-sm file:font-medium file:cursor-pointer hover:file:opacity-90"
        />
        {checkingArtwork && (
          <p className="font-mono text-xs text-paper/50 mt-1">Checking file for embedded artwork...</p>
        )}
      </div>

      {embeddedArtwork && (
        <div className="flex items-center gap-4 border border-gold/40 bg-gold/5 rounded-lg px-4 py-3">
          <div className="w-14 h-14 rounded bg-paper/10 flex-shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={URL.createObjectURL(embeddedArtwork.blob)}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <p className="font-mono text-xs text-paper">
              We found artwork already attached to this song file — use it as the cover?
            </p>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={acceptEmbeddedArtwork}
                className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90"
              >
                Use this artwork
              </button>
              <button
                type="button"
                onClick={declineEmbeddedArtwork}
                className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:bg-paper/10"
              >
                No, I'll upload my own
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">Cover art</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded bg-paper/10 flex-shrink-0 overflow-hidden border border-paper/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverFile ? URL.createObjectURL(coverFile) : DEFAULT_TRACK_COVER_URL}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 border border-dashed border-paper/25 rounded-lg px-4 py-3">
            {coverFile ? (
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-paper/70 truncate">{coverFile.name}</p>
                <button
                  type="button"
                  onClick={() => setCoverFile(null)}
                  className="font-mono text-xs text-rust hover:underline flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <p className="font-mono text-xs text-paper/60 mb-2">
                  Upload your artwork here — or leave blank for the default Fyby cover.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  className="w-full text-paper font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-gold file:text-ink file:font-mono file:text-xs file:font-medium file:cursor-pointer hover:file:opacity-90"
                />
              </>
            )}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="mt-2 bg-gold text-ink font-mono text-base font-medium rounded-lg px-6 py-3.5 hover:opacity-90 disabled:opacity-50"
      >
        {uploading ? "Publishing..." : "Publish"}
      </button>
    </form>
  );
}
