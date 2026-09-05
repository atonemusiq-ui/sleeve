"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createAlbum, updateAlbum, deleteAlbum } from "@/app/actions/albums";

export type AlbumTrackRef = { id: string; title: string };
export type Album = {
  id: string;
  title: string;
  price_cents: number;
  tracks: AlbumTrackRef[]; // already ordered by track_order
};

// Nudges only — createAlbum/updateAlbum (app/actions/albums.ts) accept any
// price in the $1-$100 range, an artist can always override. The cutoff
// between the two tiers is a full-length album: 12+ tracks.
const FULL_ALBUM_TRACK_COUNT = 12;

function suggestedPriceFor(trackCount: number): string {
  return trackCount >= FULL_ALBUM_TRACK_COUNT ? "17.00" : "8.00";
}
function suggestionLabel(trackCount: number): string {
  return trackCount >= FULL_ALBUM_TRACK_COUNT
    ? `Suggested $15-20 for a ${FULL_ALBUM_TRACK_COUNT}+ track album`
    : `Suggested $7-10 for an album under ${FULL_ALBUM_TRACK_COUNT} tracks`;
}

export default function AlbumManager({
  tracks,
  albums,
}: {
  tracks: AlbumTrackRef[];
  albums: Album[];
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="border border-paper/15 rounded-lg p-6 mb-10 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Albums</h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            disabled={tracks.length === 0}
            className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-40"
          >
            + New album
          </button>
        )}
      </div>

      {tracks.length === 0 && (
        <p className="font-mono text-xs text-paper/50">
          Publish at least one track before you can bundle an album.
        </p>
      )}

      {creating && (
        <AlbumForm
          tracks={tracks}
          onDone={() => setCreating(false)}
        />
      )}

      {albums.length === 0 && !creating && (
        <p className="font-mono text-xs text-paper/50">No albums yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {albums.map((album) =>
          editingId === album.id ? (
            <AlbumForm
              key={album.id}
              tracks={tracks}
              album={album}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <AlbumRow
              key={album.id}
              album={album}
              onEdit={() => setEditingId(album.id)}
            />
          )
        )}
      </div>
    </div>
  );
}

function AlbumRow({ album, onEdit }: { album: Album; onEdit: () => void }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!window.confirm(`Take down the album "${album.title}"? Individual tracks stay published.`)) {
      return;
    }
    setBusy(true);
    const formData = new FormData();
    formData.set("id", album.id);
    await deleteAlbum(formData);
    router.refresh();
  }

  return (
    <div className="border border-paper/15 rounded-lg px-5 py-4 bg-paper/5 flex items-center justify-between gap-4">
      <div>
        <span className="font-display text-lg block">{album.title}</span>
        <span className="font-mono text-xs text-paper/60">
          {album.tracks.length} track{album.tracks.length === 1 ? "" : "s"} · {album.tracks.map((t) => t.title).join(", ")}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="font-mono text-forest">${(album.price_cents / 100).toFixed(2)}</span>
        <button
          onClick={onEdit}
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
  );
}

function AlbumForm({
  tracks,
  album,
  onDone,
}: {
  tracks: AlbumTrackRef[];
  album?: Album;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(album?.title ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>(album?.tracks.map((t) => t.id) ?? []);
  const [price, setPrice] = useState(album ? (album.price_cents / 100).toFixed(2) : suggestedPriceFor(0));
  const [priceTouched, setPriceTouched] = useState(Boolean(album));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const unselectedTracks = tracks.filter((t) => !selectedIds.includes(t.id));

  function addTrack(id: string) {
    setSelectedIds((prev) => [...prev, id]);
    if (!priceTouched) setPrice(suggestedPriceFor(selectedIds.length + 1));
  }

  function removeTrack(id: string) {
    setSelectedIds((prev) => {
      const next = prev.filter((t) => t !== id);
      if (!priceTouched) setPrice(suggestedPriceFor(next.length));
      return next;
    });
  }

  function move(index: number, direction: -1 | 1) {
    setSelectedIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Choose at least one track.");
      return;
    }

    setBusy(true);
    const formData = new FormData();
    if (album) formData.set("id", album.id);
    formData.set("title", title);
    formData.set("price", price);
    formData.set("trackIds", JSON.stringify(selectedIds));

    const result = album ? await updateAlbum(formData) : await createAlbum(formData);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gold/30 rounded-lg p-5 bg-gold/5 flex flex-col gap-4"
    >
      {error && <p className="text-rust font-mono text-sm">{error}</p>}

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">Album title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
        />
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">
          Tracks in this album (in order)
        </label>
        {selectedIds.length === 0 && (
          <p className="font-mono text-xs text-paper/40 mb-2">No tracks selected yet.</p>
        )}
        <div className="flex flex-col gap-1.5 mb-2">
          {selectedIds.map((id, index) => (
            <div
              key={id}
              className="flex items-center gap-2 bg-paper/5 border border-paper/15 rounded px-2 py-1.5"
            >
              <span className="font-mono text-xs text-paper/50 w-5">{index + 1}.</span>
              <span className="flex-1 text-sm">{trackById.get(id)?.title ?? "Unknown track"}</span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="font-mono text-xs px-1.5 rounded border border-paper/20 hover:bg-paper/10 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === selectedIds.length - 1}
                className="font-mono text-xs px-1.5 rounded border border-paper/20 hover:bg-paper/10 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeTrack(id)}
                className="font-mono text-xs px-1.5 rounded border border-rust/40 text-rust hover:bg-rust/10"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {unselectedTracks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {unselectedTracks.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => addTrack(t.id)}
                className="font-mono text-xs px-2 py-1 rounded border border-paper/20 hover:bg-paper/10"
              >
                + {t.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block font-mono text-xs text-paper/60 mb-1">Album price (USD)</label>
        <input
          type="number"
          step="0.01"
          min="1"
          max="100"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            setPriceTouched(true);
          }}
          required
          className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
        />
        <p className="font-mono text-xs text-paper/40 mt-1">{suggestionLabel(selectedIds.length)}</p>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving..." : album ? "Save album" : "Create album"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="font-mono text-xs px-3 py-1.5 rounded border border-paper/20 hover:bg-paper/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
