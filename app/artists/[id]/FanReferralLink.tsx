"use client";

import { useState } from "react";

// A logged-in fan's own shareable link to this artist page — distinct from
// SuperFanSection's referral link, which (see that component) is actually
// built from the *incoming* ?ref= value rather than the viewer's own id.
// This one always uses the current viewer's own fanId, so "share this link"
// genuinely gives out their own code. Purchases made from it are logged
// against artist_fans.referred_by_fan_id by the webhook (see
// app/api/webhooks/stripe/route.ts) — no reward logic yet, just the log, per
// the brief.
export default function FanReferralLink({ artistId, fanId }: { artistId: string; fanId: string }) {
  const [copied, setCopied] = useState(false);

  const referralLink =
    typeof window !== "undefined" ? `${window.location.origin}/artists/${artistId}?ref=${fanId}` : "";

  return (
    <div className="border border-paper/15 rounded-lg p-4 mt-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <span className="font-mono text-xs text-paper/50">Share your link:</span>
      <code className="font-mono text-xs text-paper/70 truncate flex-1">{referralLink}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(referralLink);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 flex-shrink-0"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
