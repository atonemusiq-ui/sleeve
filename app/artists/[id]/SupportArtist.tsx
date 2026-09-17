import { startSuperFanCheckout, startGiftCheckout } from "@/app/actions/superfan";

// The two ways to send an artist money that aren't buying a specific track
// or album: the $9/month Super Fan subscription and a one-off gift. Both are
// plain server-action forms (same pattern as the Buy button on the artist
// page) rather than client components — there's no interactive state to
// hold, so this stays server-rendered with no client JS.
//
// Neither form is rendered interactively for the artist themselves: an
// artist previewing their own page sees the panels with the buttons replaced
// by a note, so they can tell what fans are offered without being able to
// subscribe to or gift themselves.
export default function SupportArtist({
  artistId,
  artistName,
  isOwner,
  isLoggedIn,
  isSuperFan,
  referredByFanId,
}: {
  artistId: string;
  artistName: string;
  isOwner: boolean;
  isLoggedIn: boolean;
  isSuperFan: boolean;
  referredByFanId: string | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ---- Super Fan ---- */}
      <div className="border border-gold/30 rounded-lg p-5 lg:p-6 bg-gold/5 flex flex-col">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h3 className="font-display text-xl text-gold">Super Fan</h3>
          <span className="font-mono text-sm text-forest whitespace-nowrap">$9/month</span>
        </div>

        <p className="font-mono text-xs text-paper/70 mb-3">
          $9 a month straight to {artistName}, on top of anything you buy. They keep 80%
          — the same split as a track sale. Cancel any time.
        </p>

        {/* Deliberately does not list member perks. Exclusive content,
            shoutouts, private show videos and the two-way video exchange are
            planned but not built — nothing reads artist_subscriptions to gate
            any of them yet — so promising them here would be charging $9/month
            for something that doesn't exist. Sell the support, not the perks,
            until the perks are real. */}
        <p className="font-mono text-xs text-paper/50 mb-5">
          Member perks are on the way. Subscribing today is direct monthly support, not
          access to them yet.
        </p>

        <div className="mt-auto">
          {isOwner ? (
            <p className="font-mono text-xs text-paper/50">
              This is what fans see — you can&apos;t subscribe to your own page.
            </p>
          ) : isSuperFan ? (
            <p className="font-mono text-xs text-forest border border-forest/40 rounded px-3 py-2 bg-forest/10">
              You&apos;re a Super Fan of {artistName}. Manage or cancel it from{" "}
              <span className="text-paper/70">My Music</span>.
            </p>
          ) : (
            <form action={startSuperFanCheckout}>
              <input type="hidden" name="artistId" value={artistId} />
              {referredByFanId && (
                <input type="hidden" name="referredByFanId" value={referredByFanId} />
              )}
              <button
                type="submit"
                className="w-full sm:w-auto bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
              >
                {isLoggedIn ? "Become a Super Fan" : "Log in to become a Super Fan"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ---- One-off gift ---- */}
      <div className="border border-paper/15 rounded-lg p-5 lg:p-6 bg-paper/5 flex flex-col">
        <h3 className="font-display text-xl mb-2">Send a gift</h3>
        <p className="font-mono text-xs text-paper/60 mb-5">
          A one-time thank-you straight to {artistName} — no track, no subscription, any
          amount you like.
        </p>

        {isOwner ? (
          <p className="font-mono text-xs text-paper/50 mt-auto">
            This is what fans see — you can&apos;t send yourself a gift.
          </p>
        ) : (
          <form action={startGiftCheckout} className="flex flex-col gap-4 mt-auto">
            <input type="hidden" name="artistId" value={artistId} />

            <div>
              <label
                htmlFor="gift-amount"
                className="block font-mono text-xs text-paper/60 mb-1"
              >
                Amount (USD)
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-paper/50">$</span>
                <input
                  id="gift-amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={5}
                  required
                  className="w-28 bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper font-mono"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="gift-message"
                className="block font-mono text-xs text-paper/60 mb-1"
              >
                Message (optional)
              </label>
              <textarea
                id="gift-message"
                name="message"
                rows={3}
                maxLength={500}
                placeholder="Say something to the artist..."
                className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
              />
            </div>

            <button
              type="submit"
              className="self-start font-mono text-sm px-4 py-2.5 rounded border border-gold/40 text-gold hover:bg-gold/10"
            >
              {isLoggedIn ? "Send gift" : "Log in to send a gift"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
