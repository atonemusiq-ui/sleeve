"use client";

import { useState } from "react";

// "Share a snippet" for a song in the fan's Library: sends a link to
// app/s/[trackId] (the 15-second preview plus a Buy button). ?ref= credits
// this fan through Fyby's referral system. Uses the phone's share sheet
// (Messages, Instagram, WhatsApp...) and falls back to copying the link.
export default function ShareSnippetButton({
  trackId,
  title,
  artistName,
  fanId,
}: {
  trackId: string;
  title: string;
  artistName: string;
  fanId: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/s/${trackId}?ref=${fanId}`;
    const text = `Listen to "${title}" by ${artistName} on Fyby`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return; // they closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link to share:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="font-mono text-xs px-3 py-2 rounded border border-paper/30 text-paper/80 hover:bg-paper/10 flex-shrink-0"
    >
      {copied ? "Link copied!" : "Share a snippet"}
    </button>
  );
}
