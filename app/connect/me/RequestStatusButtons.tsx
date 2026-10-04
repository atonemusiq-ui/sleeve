"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateConnectRequestStatus } from "@/app/actions/connect";

const ACTIONS: { status: string; label: string }[] = [
  { status: "accepted", label: "Accept" },
  { status: "declined", label: "Decline" },
  { status: "done", label: "Mark done" },
];

export default function RequestStatusButtons({ requestId, status }: { requestId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: string) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("status", next);
    const result = await updateConnectRequestStatus(fd);
    setBusy(false);
    if (result.error) setError(result.error);
    router.refresh();
  }

  const options = ACTIONS.filter((a) => a.status !== status && !(status === "new" && a.status === "done"));

  return (
    <span className="flex flex-wrap items-center gap-2">
      {options.map((a) => (
        <button
          key={a.status}
          type="button"
          disabled={busy}
          onClick={() => set(a.status)}
          className="font-mono text-xs px-3 py-1.5 rounded-full border border-paper/25 hover:border-gold/60 hover:text-gold disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
      {error && <span className="font-mono text-xs text-rust">{error}</span>}
    </span>
  );
}
