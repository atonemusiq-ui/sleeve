"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addContributor,
  updateContributor,
  deleteContributor,
  markContributorPaid,
} from "@/app/actions/contributors";

export type Contributor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  publishing_info: string | null;
  percentage: number;
  owedCents: number;
};

export default function ContributorManager({
  trackId,
  contributors,
}: {
  trackId: string;
  contributors: Contributor[];
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const totalPercentage = contributors.reduce((sum, c) => sum + Number(c.percentage), 0);

  async function handleAdd(formData: FormData) {
    setBusy(true);
    setError(null);
    formData.set("trackId", trackId);
    const result = await addContributor(formData);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAdding(false);
    router.refresh();
  }

  async function handleUpdate(formData: FormData) {
    setBusy(true);
    setError(null);
    formData.set("trackId", trackId);
    const result = await updateContributor(formData);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this contributor? Their payout history stays on record.")) return;
    setBusy(true);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("trackId", trackId);
    await deleteContributor(formData);
    setBusy(false);
    router.refresh();
  }

  async function handleMarkPaid(contributorId: string) {
    setBusy(true);
    const formData = new FormData();
    formData.set("contributorId", contributorId);
    formData.set("trackId", trackId);
    await markContributorPaid(formData);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="border-t border-paper/10 mt-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-xs text-paper/60 hover:text-gold"
      >
        {open ? "▾" : "▸"} Contributors ({contributors.length}, {totalPercentage.toFixed(1)}% split)
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {error && <p className="text-rust font-mono text-xs">{error}</p>}

          {contributors.map((c) =>
            editingId === c.id ? (
              <form
                key={c.id}
                action={handleUpdate}
                className="border border-paper/15 rounded px-3 py-2 flex flex-col gap-2 bg-paper/5"
              >
                <input type="hidden" name="id" value={c.id} />
                <ContributorFields defaults={c} />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="font-mono text-xs px-2 py-1 rounded bg-gold text-ink disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="font-mono text-xs px-2 py-1 rounded border border-paper/20"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div
                key={c.id}
                className="border border-paper/15 rounded px-3 py-2 flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <span className="text-paper">{c.name}</span>{" "}
                  <span className="font-mono text-forest">{c.percentage}%</span>
                  {c.email && <span className="font-mono text-xs text-paper/50 ml-2">{c.email}</span>}
                  <div className="font-mono text-xs text-paper/50 mt-0.5">
                    Owed: ${(c.owedCents / 100).toFixed(2)}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {c.owedCents > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(c.id)}
                      disabled={busy}
                      className="font-mono text-xs px-2 py-1 rounded border border-forest/40 text-forest hover:bg-forest/10 disabled:opacity-50"
                    >
                      Mark as paid
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingId(c.id)}
                    className="font-mono text-xs px-2 py-1 rounded border border-paper/20 hover:bg-paper/10"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    disabled={busy}
                    className="font-mono text-xs px-2 py-1 rounded border border-rust/40 text-rust hover:bg-rust/10 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}

          {adding ? (
            <form
              action={handleAdd}
              className="border border-paper/15 rounded px-3 py-2 flex flex-col gap-2 bg-paper/5"
            >
              <ContributorFields />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="font-mono text-xs px-2 py-1 rounded bg-gold text-ink disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                  }}
                  className="font-mono text-xs px-2 py-1 rounded border border-paper/20"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            totalPercentage < 100 && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="font-mono text-xs px-2 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10 self-start"
              >
                + Add contributor
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ContributorFields({ defaults }: { defaults?: Partial<Contributor> }) {
  return (
    <>
      <input
        name="name"
        placeholder="Name"
        defaultValue={defaults?.name ?? ""}
        required
        className="w-full bg-paper/5 border border-paper/20 rounded px-2 py-1.5 text-paper text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="email"
          type="email"
          placeholder="Email (optional)"
          defaultValue={defaults?.email ?? ""}
          className="w-full bg-paper/5 border border-paper/20 rounded px-2 py-1.5 text-paper text-sm"
        />
        <input
          name="phone"
          placeholder="Phone (optional)"
          defaultValue={defaults?.phone ?? ""}
          className="w-full bg-paper/5 border border-paper/20 rounded px-2 py-1.5 text-paper text-sm"
        />
      </div>
      <input
        name="publishingInfo"
        placeholder="Publishing info (optional)"
        defaultValue={defaults?.publishing_info ?? ""}
        className="w-full bg-paper/5 border border-paper/20 rounded px-2 py-1.5 text-paper text-sm"
      />
      <input
        name="percentage"
        type="number"
        step="0.1"
        min="0.1"
        max="100"
        placeholder="Percentage of artist payout"
        defaultValue={defaults?.percentage ?? ""}
        required
        className="w-full bg-paper/5 border border-paper/20 rounded px-2 py-1.5 text-paper text-sm font-mono"
      />
    </>
  );
}
