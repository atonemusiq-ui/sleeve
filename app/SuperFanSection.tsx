"use client";

import { useState } from "react";
import { startSuperFanCheckout, startGiftCheckout } from "@/app/actions/superfan";

// The Super Fan section on a public artist page (app/artists/[id]/page.tsx):
// $9/month subscription with exclusive content, shoutouts, private show
// videos, and a two-way video exchange (that last piece built in a later
// step), plus a one-time gift option and a referral link. isSuperFan is
// passed in from the server page, which already loads the viewer's session
// and can check artist_subscriptions in one query alongside everything else
// it fetches, rather than this client component fetching it separately.
export default function SuperFanSection({
    artistId,
    artistName,
    isLoggedIn,
    isSuperFan,
    referralFanId,
}: {
    artistId: string;
    artistName: string;
    isLoggedIn: boolean;
    isSuperFan: boolean;
    referralFanId?: string | null;
}) {
    const [showGiftForm, setShowGiftForm] = useState(false);
    const [copied, setCopied] = useState(false);

  const referralLink =
        referralFanId && typeof window !== "undefined"
        ? `${window.location.origin}/artists/${artistId}?ref=${referralFanId}`
          : null;

  return (
        <section className="border border-paper/15 rounded-lg p-6 mt-8">
              <h2 className="font-display text-xl text-gold mb-2">Super Fan</h2>
              <p className="font-body text-paper/80 mb-4">
                      Support {artistName} directly for $9/month and get exclusive content,
                      personal shoutouts, private videos from shows, and a two-way video
                      exchange where you and {artistName} can send videos back and forth.
              </p>
    
          {isSuperFan ? (
                  <p className="font-body text-gold mb-4">
                            You&apos;re a Super Fan of {artistName}. Thank you for the support!
                  </p>
                ) : (
                  <form action={startSuperFanCheckout}>
                            <input type="hidden" name="artistId" value={artistId} />
                            <button
                                          type="submit"
                                          className="bg-gold text-black font-body rounded px-4 py-2 hover:opacity-90"
                                        >
                                        Become a Super Fan -- $9/mo
                            </button>
                  </form>
              )}
        
              <div className="mt-6">
                {showGiftForm ? (
                    <form action={startGiftCheckout} className="flex flex-col gap-2 max-w-sm">
                                <input type="hidden" name="artistId" value={artistId} />
                                <label className="font-body text-sm text-paper/60">
                                              Gift amount (USD)
                                              <input
                                                                type="number"
                                                                name="amount"
                                                                min={1}
                                                                step={1}
                                                                required
                                                                className="mt-1 w-full bg-transparent border border-paper/20 rounded px-3 py-2 text-paper"
                                                              />
                                </label>
                                <label className="font-body text-sm text-paper/60">
                                              Message (optional)
                                              <textarea
                                                                name="message"
                                                                maxLength={500}
                                                                className="mt-1 w-full bg-transparent border border-paper/20 rounded px-3 py-2 text-paper"
                                                              />
                                </label>
                                <button
                                                type="submit"
                                                className="border border-gold text-gold font-body rounded px-4 py-2 hover:bg-gold/10 self-start"
                                              >
                                              Send gift
                                </button>
                    </form>
                  ) : (
                    <button
                                  type="button"
                                  onClick={() => setShowGiftForm(true)}
                                  className="font-body text-sm text-gold underline"
                                >
                                Or send {artistName} a one-time gift
                    </button>
                      )}
              </div>
        
          {isLoggedIn && referralLink && (
                  <div className="mt-6 pt-4 border-t border-paper/15">
                            <p className="font-mono text-xs text-paper/40 mb-2">
                                        Refer a friend to {artistName}&apos;s page:
                            </p>
                            <div className="flex gap-2 items-center">
                                        <input
                                                        readOnly
                                                        value={referralLink}
                                                        className="flex-1 bg-transparent border border-paper/20 rounded px-3 py-2 text-paper text-sm font-mono"
                                                     />
                                        <button
                                                        type="button"
                                                        onClick={() => {
                                                                          navigator.clipboard.writeText(referralLink);
                                                                          setCopied(true);
                                                                          setTimeout(() => setCopied(false), 2000);
                                                        }}
                                                        className="border border-paper/20 rounded px-3 py-2 text-sm text-paper hover:border-gold"
                                                      >
                                          {copied ? "Copied!" : "Copy"}
                                        </button>
                                        </div>
                  </div>
              )}
        </section>
      );
}
