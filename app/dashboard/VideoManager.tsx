"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startVideoUnlockCheckout, saveBioVideo, removeBioVideo } from "@/app/actions/video";
import { VIDEO_TIER_OPTIONS, type VideoTier } from "@/lib/videoTiers";
import { VIDEO_CONTENT_POLICY_TEXT } from "@/lib/videoPolicy";
import VideoEmbed from "@/app/VideoEmbed";

export default function VideoManager({
  artistId,
  videoTier,
  bioVideoUrl,
  bioVideoType,
}: {
  artistId: string;
  videoTier: VideoTier | null;
  bioVideoUrl: string | null;
  bioVideoType: "link" | "upload" | null;
}) {
  const [mode, setMode] = useState<"link" | "upload">(videoTier === "upload" ? "upload" : "link");
  const [linkValue, setLinkValue] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Not unlocked yet — show the three price tiers rather than any editing
  // UI. Each is its own tiny form straight to Stripe (see
  // app/actions/video.ts's startVideoUnlockCheckout), same pattern as the
  // Stripe Connect button elsewhere on this dashboard.
  if (!videoTier) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {VIDEO_TIER_OPTIONS.map((option) => (
          <form
            key={option.value}
            action={startVideoUnlockCheckout}
            className="border border-paper/15 rounded-lg p-4 flex flex-col gap-2"
          >
            <input type="hidden" name="tier" value={option.value} />
            <p className="font-display text-lg">{option.label}</p>
            <p className="font-mono text-xs text-paper/60 flex-1">{option.description}</p>
            <button
              type="submit"
              className="font-mono text-sm px-3 py-2 rounded bg-gold text-ink font-medium hover:opacity-90"
            >
              Unlock — ${(option.priceCents / 100).toFixed(2)}
            </button>
          </form>
        ))}
      </div>
    );
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const result = await removeBioVideo();
      if (result.error) throw new Error(result.error);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agreed) {
      setError("Please confirm the content policy checkbox.");
      return;
    }

    setBusy(true);
    try {
      let url = linkValue.trim();

      if (mode === "upload") {
        if (!videoFile) {
          throw new Error("Please choose a video file.");
        }
        const supabase = createClient();
        const path = `${artistId}/${Date.now()}-${videoFile.name}`;
        const { error: uploadError } = await supabase.storage.from("artist-videos").upload(path, videoFile);
        if (uploadError) throw new Error(`Video upload failed: ${uploadError.message}`);
        url = supabase.storage.from("artist-videos").getPublicUrl(path).data.publicUrl;
      }

      const formData = new FormData();
      formData.set("videoType", mode);
      formData.set("videoUrl", url);
      formData.set("contentAgreed", "true");

      const result = await saveBioVideo(formData);
      if (result.error) throw new Error(result.error);

      setLinkValue("");
      setVideoFile(null);
      setAgreed(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      {bioVideoUrl && bioVideoType && (
        <div className="flex flex-col gap-2">
          <VideoEmbed type={bioVideoType} url={bioVideoUrl} />
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="self-start font-mono text-xs text-rust hover:underline disabled:opacity-50"
          >
            Remove video
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="border border-paper/15 rounded-lg p-4 flex flex-col gap-3">
        {videoTier === "both" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`font-mono text-xs px-3 py-1.5 rounded border ${
                mode === "link" ? "border-gold text-gold" : "border-paper/20 text-paper/60"
              }`}
            >
              Paste a link
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`font-mono text-xs px-3 py-1.5 rounded border ${
                mode === "upload" ? "border-gold text-gold" : "border-paper/20 text-paper/60"
              }`}
            >
              Upload a file
            </button>
          </div>
        )}

        {mode === "link" ? (
          <div>
            <label className="block font-mono text-xs text-paper/60 mb-1">YouTube or Vimeo link</label>
            <input
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
            />
          </div>
        ) : (
          <div>
            <label className="block font-mono text-xs text-paper/60 mb-1">Video file</label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              className="w-full text-paper font-mono text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-gold file:text-ink file:font-mono file:text-sm file:font-medium file:cursor-pointer hover:file:opacity-90"
            />
          </div>
        )}

        <label className="flex items-start gap-2 font-mono text-xs text-paper/70">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>{VIDEO_CONTENT_POLICY_TEXT}</span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="self-start font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50"
        >
          {busy ? "Saving..." : bioVideoUrl ? "Replace video" : "Save video"}
        </button>
      </form>
    </div>
  );
}
