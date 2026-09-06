"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateTrack } from "@/app/actions/tracks";
import { GENRES, MAX_CUSTOM_TAG_LENGTH, COVERS_GENRE } from "@/lib/genres";
import { AI_DISCLOSURE_LEVELS, aiDisclosureBadge, type AiDisclosureLevel } from "@/lib/aiDisclosure";
import ContributorManager, { type Contributor } from "./ContributorManager";

// Fixed price menu — matches ALLOWED_TRACK_PRICE_CENTS in
// app/actions/tracks.ts, which is what actually enforces this server-side.
const TRACK_PRICE_OPTIONS = ["3.00", "4.00", "5.00"];

type Track = {
  id: string;
  title: string;
  price_cents: number;
  cover_url: string | null;
  audio_path: string | null;
  preview_url: string | null;
  playUrl: string | null;
  genre: string | null;
  custom_tag: string | null;
  ai_disclosure: AiDisclosureLevel;
};

export default function TrackList({
  tracks,
  artistId,
  contributorsByTrack,
}: {
  tracks: Track[];
  artistId: string;
  contributorsByTrack: Record<string, Contributor[]>;
}) {
  if (tracks.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {tracks.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          artistId={artistId}
          contributors={contributorsByTrack[track.id] ?? []}
        />
      ))}
    </div>
  );
}

function TrackRow({
  track,
  artistId,
  contributors,
}: {
  track: Track;
  artistId: string;
  contributors: Contributor[];
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(track.title);
  const [price, setPrice] = useState((track.price_cents / 100).toFixed(2));
  const [genre, setGenre] = useState(track.genre ?? "");
  const [customTag, setCustomTag] = useState(track.custom_tag ?? "");
  const [aiDisclosure, setAiDisclosure] = useState(track.ai_disclosure);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      // Cover upload stays a direct client->storage call (server actions
      // don't take File objects well) — everything else (including the
      // actual price/title write) goes through updateTrack() now, which
      // enforces the fixed $3/$4/$5 price menu server-side rather than
      // trusting whatever this form sends. See app/actions/tracks.ts.
      let coverUrl: string | null = null;
      if (coverFile) {
        const supabase = createClient();
        const coverPath = `${artistId}/${Date.now()}-${coverFile.name}`;
        const { error: coverError } = await supabase.storage
          .from("track-covers")
          .upload(coverPath, coverFile);
        if (coverError) throw new Error(`Cover upload failed: ${coverError.message}`);
        coverUrl = supabase.storage.from("track-covers").getPublicUrl(coverPath).data.publicUrl;
      }

      const formData = new FormData();
      formData.set("trackId", track.id);
      formData.set("title", title);
      formData.set("price", price);
      formData.set("genre", genre);
      formData.set("customTag", customTag);
      formData.set("aiDisclosure", aiDisclosure);
      if (coverUrl) formData.set("coverUrl", coverUrl);

      const result = await updateTrack(formData);
      if (result.error) throw new Error(result.error);

      setEditing(false);
      setCoverFile(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Take down "${track.title}"? This can't be undone.`)) {
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();

    try {
      // Delete the row first — RLS ("artists can delete their own tracks")
      // scopes this to tracks this artist actually owns.
      const { error: deleteError } = await supabase.from("tracks").delete().eq("id", track.id);
      if (deleteError) throw new Error(`Delete failed: ${deleteError.message}`);

      // Best-effort storage cleanup. The track is already gone from the
      // catalog even if this fails, so don't block on it or surface it as a
      // hard error — an orphaned file in storage is a much smaller problem
      // than a delete that appears to fail.
      if (track.audio_path) {
        await supabase.storage.from("track-audio").remove([track.audio_path]);
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 flex flex-col gap-3"
      >
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
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">
            Your own tag (optional)
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
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
          >
            {AI_DISCLOSURE_LEVELS.map((level) => (
              <option key={level.value} value={level.value} className="bg-ink text-paper">
                {level.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">
            Replace cover art (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            className="w-full text-paper font-mono text-sm"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
              setTitle(track.title);
              setPrice((track.price_cents / 100).toFixed(2));
              setGenre(track.genre ?? "");
              setCustomTag(track.custom_tag ?? "");
              setAiDisclosure(track.ai_disclosure);
              setCoverFile(null);
            }}
            disabled={busy}
            className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:bg-paper/10"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const needsCoverCredit = track.genre === COVERS_GENRE && contributors.length === 0;

  return (
    <div className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 flex flex-col gap-3">
      {error && <p className="text-rust font-mono text-sm">{error}</p>}
      {needsCoverCredit && (
        <p className="font-mono text-xs text-rust bg-rust/10 border border-rust/30 rounded px-3 py-2">
          This is tagged as a cover — it's blocked from sale until you credit the original
          songwriter/producer as a contributor below (with their royalty share).
        </p>
      )}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded bg-paper/10 flex-shrink-0 overflow-hidden">
          {track.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-paper/30 text-xs">
              ♪
            </div>
          )}
        </div>
        <span className="font-display text-lg flex-1">{track.title}</span>
        <span className="font-mono text-forest">${(track.price_cents / 100).toFixed(2)}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="font-mono text-xs px-2 py-1 rounded border border-paper/20 hover:bg-paper/10"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="font-mono text-xs px-2 py-1 rounded border border-rust/40 text-rust hover:bg-rust/10 disabled:opacity-50"
          >
            {busy ? "..." : "Delete"}
          </button>
        </div>
      </div>
      {(track.genre || track.custom_tag || aiDisclosureBadge(track.ai_disclosure)) && (
        <div className="flex flex-wrap gap-1.5">
          {track.genre && (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-paper/20 text-paper/60">
              {track.genre}
            </span>
          )}
          {track.custom_tag && (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-paper/20 text-paper/60">
              #{track.custom_tag}
            </span>
          )}
          {aiDisclosureBadge(track.ai_disclosure) && (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-gold/40 text-gold">
              {aiDisclosureBadge(track.ai_disclosure)}
            </span>
          )}
        </div>
      )}
      {track.playUrl && <audio controls src={track.playUrl} className="w-full h-10" />}
      {!track.preview_url && (
        <p className="font-mono text-xs text-rust mt-1">Preview unavailable, fans won't hear a sample until this is fixed.</p>
      )}
      <ContributorManager trackId={track.id} contributors={contributors} />
    </div>
  );
}
