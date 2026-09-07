"use client";

import { useState } from "react";
import { reportVideo } from "@/app/actions/video";

// The enforcement side of the content policy attestation an artist agrees
// to before adding a video (lib/videoPolicy.ts) — a fan flags it here, an
// admin acts on it in app/admin/videos/page.tsx. No confirmation beyond
// "thanks" is shown; this is a moderation signal, not a support ticket.
export default function ReportVideoButton({
  artistId,
  videoUrl,
}: {
  artistId: string;
  videoUrl: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function handleReport() {
    setState("sending");
    const formData = new FormData();
    formData.set("artistId", artistId);
    formData.set("videoUrl", videoUrl);
    await reportVideo(formData);
    setState("sent");
  }

  if (state === "sent") {
    return <p className="font-mono text-xs text-paper/40 mt-2">Thanks — this has been reported.</p>;
  }

  return (
    <button
      type="button"
      onClick={handleReport}
      disabled={state === "sending"}
      className="font-mono text-xs text-paper/40 hover:text-rust mt-2 disabled:opacity-50"
    >
      Report inappropriate content
    </button>
  );
}
