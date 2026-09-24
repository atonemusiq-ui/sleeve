"use client";

import { useState } from "react";

// "One-tap share" for the receipt-style image at app/receipt/[purchaseId]/
// route.tsx. navigator.share with the image attached as a file is the
// closest thing to a real one-tap share on the phones most fans will be on
// (native share sheet — Messages, Instagram Stories, etc. all accept an
// image file there); falls back to copying the image link for anything
// that doesn't support it (most desktop browsers).
export default function ShareReceiptSection({ purchaseId, siteUrl }: { purchaseId: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const imageUrl = `${siteUrl}/receipt/${purchaseId}`;

  async function handleShare() {
    if (typeof navigator === "undefined") return;

    if (navigator.share) {
      try {
        // Try attaching the actual image file first — falls through to a
        // plain link share if the browser can't fetch/attach it for
        // whatever reason, rather than failing silently.
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], "fyby-receipt.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "I just bought a song on Fyby" });
          return;
        }
      } catch {
        // fall through to link share below
      }
      try {
        await navigator.share({ title: "I just bought a song on Fyby", url: imageUrl });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }

    navigator.clipboard.writeText(imageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border border-paper/15 rounded-lg p-6 mb-10 bg-paper/5">
      <p className="font-mono text-xs text-paper/50 mb-4">Share your purchase</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Purchase receipt" className="w-full rounded-lg mb-4" />
      <button
        type="button"
        onClick={handleShare}
        className="font-mono text-sm px-4 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90"
      >
        {copied ? "Link copied!" : "Share"}
      </button>
    </div>
  );
}
