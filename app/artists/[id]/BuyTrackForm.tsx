"use client";

import { useState } from "react";
import { startCheckout } from "@/app/actions/checkout";

// The storefront Buy button (app/artists/[id]/page.tsx), plus an optional
// "this is a gift" toggle that reveals a recipient-email field. Pulled out
// into its own client component because the toggle needs local state — the
// plain <form action={startCheckout}> this replaced had none.
//
// referredByFanId is the shape-checked ?ref= value the artist page already
// computes (see that file's referredByFanId) — passed straight through as a
// hidden field so a purchase made from a shared referral link gets logged
// against it server-side (app/actions/checkout.ts re-validates it; nothing
// here is trusted on its own).
export default function BuyTrackForm({
  trackId,
  isLoggedIn,
  referredByFanId,
  isPreorder = false,
}: {
  trackId: string;
  isLoggedIn: boolean;
  referredByFanId?: string | null;
  // Sold before its release date (lib/preorder.ts) -- same checkout, the
  // button just says what the fan is getting.
  isPreorder?: boolean;
}) {
  const [isGift, setIsGift] = useState(false);

  return (
    <form action={startCheckout} className="flex flex-col items-end gap-2">
      <input type="hidden" name="trackId" value={trackId} />
      {referredByFanId && <input type="hidden" name="referredByFanId" value={referredByFanId} />}
      {/* Where to bounce back to after a "log in to buy" detour
          (app/actions/checkout.ts's startCheckout) — this page, including
          the ?ref= referral token, so a fan who had to sign up mid-purchase
          lands back on a page where Buy still carries their referral
          instead of on the homepage. */}
      <input
        type="hidden"
        name="returnTo"
        value={typeof window !== "undefined" ? window.location.pathname + window.location.search : ""}
      />

      {isLoggedIn && (
        <label className="flex items-center gap-1.5 font-mono text-xs text-paper/50">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => setIsGift(e.target.checked)}
            className="accent-gold"
          />
          This is a gift
        </label>
      )}

      {isGift && (
        <input
          type="email"
          name="giftRecipientEmail"
          required
          placeholder="recipient@email.com"
          className="bg-paper/5 border border-paper/20 rounded px-2 py-1 text-paper font-mono text-xs w-48"
        />
      )}

      <button
        type="submit"
        className="font-mono text-xs px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
      >
        {!isLoggedIn
          ? isPreorder
            ? "Log in to pre-order"
            : "Log in to buy"
          : isGift
          ? "Send as a gift"
          : isPreorder
          ? "Pre-order"
          : "Buy"}
      </button>
    </form>
  );
}
