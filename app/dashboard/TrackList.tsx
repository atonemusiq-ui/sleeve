"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateTrack, setRadioSettings } from "@/app/actions/tracks";
import { MOODS, PREMIERE_TIERS, PRO_FREE_PREMIERE_EVERY_DAYS, PRO_FREE_PREMIERE_TIER, RADIO_EXCLUDED_GENRES } from "@/lib/radio";
import { startRadioPremiere } from "@/app/actions/radioPremiere";
import { MAX_CUSTOM_TAG_LENGTH, COVERS_GENRE, subgenresFor } from "@/lib/genres";
import { AI_DISCLOSURE_LEVELS, aiDisclosureBadge, type AiDisclosureLevel } from "@/lib/aiDisclosure";
import { startVerificationCheckout } from "@/app/actions/verification";
import { VERIFICATION_FEE_CENTS, verificationBadgeLabel } from "@/lib/verification";
import ContributorManager, { type Contributor } from "./ContributorManager";
import LicenseSettings from "./LicenseSettings";
import { formatReleaseDate, isPreorder } from "@/lib/preorder";

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
  subgenre: string | null;
  custom_tag: string | null;
  ai_disclosure: AiDisclosureLevel;
  verification_status: string;
  verification_note: string | null;
  explicit?: boolean | null;
  // Set by an admin (app/admin/moderation/page.tsx's freezeTrack) for a
  // policy violation — the artist also gets a notification when this
  // happens, but it's shown here too so it's impossible to miss.
  frozen?: boolean | null;
  frozen_reason?: string | null;
  // Phase 10: Fyby Radio consent and mood (lib/radio.ts).
  radio_opt_in?: boolean | null;
  // Pre-order release date (lib/preorder.ts); null = already released.
  release_at?: string | null;
  // Beat & sync licensing (lib/licensing.ts).
  license_enabled?: boolean | null;
  license_beat_cents?: number | null;
  license_standard_cents?: number | null;
  license_commercial_cents?: number | null;
  mood?: string | null;
};

export default function TrackList({
  tracks,
  artistId,
  contributorsByTrack,
  allGenres,
  premiereEndsByTrack = {},
  isPro = false,
}: {
  tracks: Track[];
  artistId: string;
  contributorsByTrack: Record<string, Contributor[]>;
  allGenres: string[];
  premiereEndsByTrack?: Record<string, string>;
  isPro?: boolean;
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
          allGenres={allGenres}
          premiereEndsAt={premiereEndsByTrack[track.id] ?? null}
          isPro={isPro}
        />
      ))}
    </div>
  );
}

function TrackRow({
  track,
  artistId,
  contributors,
  allGenres,
  premiereEndsAt,
  isPro,
}: {
  track: Track;
  artistId: string;
  contributors: Contributor[];
  allGenres: string[];
  premiereEndsAt: string | null;
  isPro: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(track.title);
  const [price, setPrice] = useState((track.price_cents / 100).toFixed(2));
  const [genre, setGenre] = useState(track.genre ?? "");
  const [subgenre, setSubgenre] = useState(track.subgenre ?? "");
  const [customTag, setCustomTag] = useState(track.custom_tag ?? "");
  const [aiDisclosure, setAiDisclosure] = useState(track.ai_disclosure);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [verifyNote, setVerifyNote] = useState(track.verification_note ?? "");
  const [radioOn, setRadioOn] = useState(Boolean(track.radio_opt_in));
  const [radioMood, setRadioMood] = useState(track.mood ?? "");
  const [radioBusy, setRadioBusy] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);
  const [radioLinkCopied, setRadioLinkCopied] = useState(false);
  const [showPremiere, setShowPremiere] = useState(false);

  // The shareable "playing on Fyby Radio" page (app/radio/[trackId]).
  const radioLink = `${typeof window !== "undefined" ? window.location.origin : ""}/radio/${track.id}`;
  async function copyRadioLink() {
    try {
      await navigator.clipboard.writeText(radioLink);
      setRadioLinkCopied(true);
      setTimeout(() => setRadioLinkCopied(false), 2000);
    } catch {
      window.prompt("Copy your Fyby Radio link:", radioLink);
    }
  }
  const router = useRouter();

  async function saveRadio(nextOn: boolean, nextMood: string) {
    setRadioError(null);
    setRadioBusy(true);
    const prevOn = radioOn;
    const prevMood = radioMood;
    setRadioOn(nextOn);
    setRadioMood(nextMood);
    const result = await setRadioSettings(track.id, nextOn, nextMood || null);
    if (result.error) {
      setRadioOn(prevOn);
      setRadioMood(prevMood);
      setRadioError(result.error);
    }
    setRadioBusy(false);
  }

  const subgenreOptions = useMemo(() => subgenresFor(genre), [genre]);

  function handleGenreChange(value: string) {
    setGenre(value);
    setSubgenre("");
  }

  const embedSnippet = `<iframe src="${
    typeof window !== "undefined" ? window.location.origin : ""
  }/embed/${track.id}" width="300" height="420" frameborder="0" style="border:none;overflow:hidden;"></iframe>`;

  async function handleCopyEmbed() {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the textarea below
      // is still selectable/copyable by hand, so this isn't a hard failure.
    }
  }

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
      formData.set("subgenre", subgenre);
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
            onChange={(e) => handleGenreChange(e.target.value)}
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
          >
            <option value="" className="bg-ink text-paper">
              No genre
            </option>
            {allGenres.map((g) => (
              <option key={g} value={g} className="bg-ink text-paper">
                {g}
              </option>
            ))}
          </select>
        </div>

        {subgenreOptions.length > 0 && (
          <div>
            <label className="block font-mono text-xs text-paper/60 mb-1">Subgenre (optional)</label>
            <select
              value={subgenre}
              onChange={(e) => setSubgenre(e.target.value)}
              className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
            >
              <option value="" className="bg-ink text-paper">
                No subgenre
              </option>
              {subgenreOptions.map((sg) => (
                <option key={sg} value={sg} className="bg-ink text-paper">
                  {sg}
                </option>
              ))}
            </select>
          </div>
        )}

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
              setSubgenre(track.subgenre ?? "");
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
        <span className="font-display text-lg flex-1">
          {track.title}
          {isPreorder(track.release_at) && (
            <span className="block font-mono text-xs text-flame mt-0.5">
              Pre-order · unlocks for buyers {formatReleaseDate(track.release_at as string)}
            </span>
          )}
        </span>
        <span className="font-mono text-forest">${(track.price_cents / 100).toFixed(2)}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="font-mono text-xs px-2 py-1 rounded border border-paper/20 hover:bg-paper/10"
          >
            Edit
          </button>
          <button
            onClick={() => setShowEmbed((v) => !v)}
            className="font-mono text-xs px-2 py-1 rounded border border-paper/20 hover:bg-paper/10"
          >
            {showEmbed ? "Hide embed" : "Embed this song"}
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
      {showEmbed && (
        <div className="flex flex-col gap-2 border border-paper/15 rounded px-3 py-2 bg-paper/5">
          <p className="font-mono text-xs text-paper/60">
            Paste this into any site to embed a "Buy" widget for this track.
          </p>
          <textarea
            readOnly
            value={embedSnippet}
            rows={2}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-ink border border-paper/20 rounded px-2 py-1 text-paper font-mono text-xs"
          />
          <button
            type="button"
            onClick={handleCopyEmbed}
            className="self-start font-mono text-xs px-2 py-1 rounded bg-gold text-ink font-medium hover:opacity-90"
          >
            {copied ? "Copied!" : "Copy snippet"}
          </button>
        </div>
      )}
      {track.frozen && (
        <p className="font-mono text-xs text-rust bg-rust/10 border border-rust/30 rounded px-3 py-2">
          This track was removed from Fyby by an admin
          {track.frozen_reason ? `: ${track.frozen_reason}` : "."} It&apos;s no longer visible to
          fans or buyable, but nothing else about it was touched.
        </p>
      )}
      {(track.genre ||
        track.custom_tag ||
        aiDisclosureBadge(track.ai_disclosure) ||
        verificationBadgeLabel(track.verification_status) ||
        track.explicit) && (
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
          {verificationBadgeLabel(track.verification_status) && (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-forest/50 bg-forest/10 text-forest">
              ✓ {verificationBadgeLabel(track.verification_status)}
            </span>
          )}
          {track.explicit && (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-rust/50 text-rust">
              Explicit
            </span>
          )}
        </div>
      )}
      {/* Phase 10: Fyby Radio toggle + mood, saved instantly. */}
      {!RADIO_EXCLUDED_GENRES.includes(track.genre ?? "") && (
        <div className="flex flex-wrap items-center gap-3 border border-gold/30 bg-gold/5 rounded px-3 py-2">
          <label className="flex items-center gap-2 font-mono text-xs text-paper/80">
            <input
              type="checkbox"
              checked={radioOn}
              disabled={radioBusy}
              onChange={(e) => saveRadio(e.target.checked, radioMood)}
            />
            📻 Play on Fyby Radio
          </label>
          <select
            value={radioMood}
            disabled={radioBusy}
            onChange={(e) => saveRadio(radioOn, e.target.value)}
            className="bg-ink border border-paper/20 rounded px-2 py-1 text-paper font-mono text-xs"
            aria-label="Mood"
          >
            <option value="">No mood</option>
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {radioOn && (
            <button
              type="button"
              onClick={copyRadioLink}
              className="font-mono text-xs px-2 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10"
            >
              {radioLinkCopied ? "Link copied" : "Copy radio link"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPremiere((v) => !v)}
            className="font-mono text-xs px-2 py-1 rounded border border-flame/50 text-flame hover:bg-flame/10"
          >
            {showPremiere ? "Cancel" : premiereEndsAt ? "Extend premiere" : "Premiere on Fyby Radio"}
          </button>
          {radioError && <span className="font-mono text-xs text-rust">{radioError}</span>}
          {premiereEndsAt && (
            <p className="w-full font-mono text-xs text-flame">
              Premiering on Fyby Radio until {new Date(premiereEndsAt).toLocaleDateString()}.
            </p>
          )}
          {showPremiere && (
            <form action={startRadioPremiere} className="w-full flex flex-col gap-2 pt-1">
              <input type="hidden" name="trackId" value={track.id} />
              <p className="font-mono text-xs text-paper/60">
                Heavy rotation on Fyby Radio plus a spot in &quot;Premiering now&quot; on the homepage.
                Turns radio on for this song.
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(PREMIERE_TIERS).map(([key, t], i) => (
                  <label key={key} className="flex items-center gap-1.5 font-mono text-xs text-paper/80">
                    <input type="radio" name="tier" value={key} defaultChecked={i === 0} />
                    {t.label} ·{" "}
                    {isPro && key === PRO_FREE_PREMIERE_TIER
                      ? `free with Pro (1 every ${PRO_FREE_PREMIERE_EVERY_DAYS} days)`
                      : `$${(t.priceCents / 100).toFixed(2)}`}
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="self-start font-mono text-xs px-3 py-1.5 rounded bg-flame text-ink font-medium hover:opacity-90"
              >
                Start premiere
              </button>
            </form>
          )}
        </div>
      )}
      {track.playUrl && <audio controls src={track.playUrl} className="w-full h-10" />}
      {!track.preview_url && (
        <p className="font-mono text-xs text-rust mt-1">Preview unavailable, fans won't hear a sample until this is fixed.</p>
      )}

      {/* Verified Human+AI: a paid ($9.99) application reviewed by hand (see
          app/admin/verifications/page.tsx) — status lives on the track row
          itself (verification_status), separate from the free, self-declared
          ai_disclosure field above. "pending" and "approved" can't re-apply
          (enforced again server-side in app/actions/verification.ts); a
          fresh rejection can. */}
      {track.verification_status === "pending" && (
        <p className="font-mono text-xs text-gold bg-gold/10 border border-gold/30 rounded px-3 py-2">
          Verification pending review — you'll see the badge here once it's approved.
        </p>
      )}
      {track.verification_status === "rejected" && (
        <p className="font-mono text-xs text-rust bg-rust/10 border border-rust/30 rounded px-3 py-2">
          Your last verification request wasn't approved. You can apply again below.
        </p>
      )}
      {(track.verification_status === "none" || track.verification_status === "rejected") && (
        <div>
          <button
            type="button"
            onClick={() => setShowVerifyForm((v) => !v)}
            className="font-mono text-xs px-2 py-1 rounded border border-forest/40 text-forest hover:bg-forest/10"
          >
            {showVerifyForm ? "Cancel" : "Apply for Verified Human+AI"}
          </button>
          {showVerifyForm && (
            <form
              action={startVerificationCheckout}
              className="flex flex-col gap-2 border border-paper/15 rounded px-3 py-2 bg-paper/5 mt-2"
            >
              <input type="hidden" name="trackId" value={track.id} />
              <p className="font-mono text-xs text-paper/60">
                Describe the human involvement in this track (writing, performance, production —
                whatever makes it more than pure AI generation). Reviewed by hand for a one-time $
                {(VERIFICATION_FEE_CENTS / 100).toFixed(2)} fee, charged on submit; it isn't
                refunded if the application is rejected.
              </p>
              <textarea
                name="note"
                required
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                rows={3}
                placeholder="e.g. I wrote the lyrics and performed the vocals; AI handled the instrumental."
                className="w-full bg-ink border border-paper/20 rounded px-2 py-1 text-paper font-mono text-xs"
              />
              <button
                type="submit"
                className="self-start font-mono text-xs px-3 py-1.5 rounded bg-forest text-paper font-medium hover:opacity-90"
              >
                Continue to payment (${(VERIFICATION_FEE_CENTS / 100).toFixed(2)})
              </button>
            </form>
          )}
        </div>
      )}

      {/* Beat & sync licensing (lib/licensing.ts). Never offered for covers --
          the song isn't the cover artist's to license. */}
      {track.genre !== COVERS_GENRE && (
        <LicenseSettings
          trackId={track.id}
          enabled={Boolean(track.license_enabled)}
          prices={{
            beat: track.license_beat_cents ?? null,
            standard: track.license_standard_cents ?? null,
            commercial: track.license_commercial_cents ?? null,
          }}
        />
      )}

      <ContributorManager trackId={track.id} contributors={contributors} />
    </div>
  );
}
