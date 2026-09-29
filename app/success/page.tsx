import { stripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatPresentmentAmount } from "@/lib/currency";
import ShareReceiptSection from "./ShareReceiptSection";
import Link from "next/link";

// One hour is plenty for a single sitting (stream + download), and keeps
// the signed URL from being usable long after the buyer's browser tab is
// gone. Revisiting this exact page (it's a bookmarkable URL — session_id is
// right there in the query string) mints a fresh one.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function ErrorState({ message }: { message: string }) {
  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-3xl text-gold mb-4">Hmm.</h1>
      <p className="text-paper/70 mb-10">{message}</p>
      <Link
        href="/"
        className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10"
      >
        Back to Fyby
      </Link>
    </main>
  );
}

type TrackAudio = { id: string; title: string; downloadUrl: string | null };

// Shared by both the single-track and album paths below — mints a signed
// download URL for the private "track-audio" bucket, or falls back to a
// legacy public audio_url for any track uploaded before audio was made
// private.
async function resolveDownloadUrl(
  admin: ReturnType<typeof createServiceRoleClient>,
  track: { audio_path: string | null; audio_url: string | null }
): Promise<string | null> {
  if (track.audio_path) {
    const { data: signed } = await admin.storage
      .from("track-audio")
      .createSignedUrl(track.audio_path, SIGNED_URL_TTL_SECONDS, { download: true });
    return signed?.signedUrl ?? null;
  }
  return track.audio_url ?? null;
}

// Only rendered when Stripe Adaptive Pricing (a Dashboard-only toggle — see
// lib/currency.ts) actually converted this specific session for the fan,
// i.e. presentment_currency differs from the currency Fyby itself charged
// in. Most fans (anyone who paid in USD, or on a session from before
// Adaptive Pricing was enabled) never see this at all.
function LocalCurrencyNote({
  presentmentAmount,
  presentmentCurrency,
  chargedAmount,
  chargedCurrency,
}: {
  presentmentAmount: number;
  presentmentCurrency: string;
  chargedAmount: number;
  chargedCurrency: string;
}) {
  return (
    <p className="font-mono text-xs text-paper/50 mb-6">
      You paid {formatPresentmentAmount(presentmentAmount, presentmentCurrency)} in your local
      currency (charged to Fyby as {formatPresentmentAmount(chargedAmount, chargedCurrency)}).
    </p>
  );
}

function AccountPrompt({ buyerEmail }: { buyerEmail: string | null }) {
  return (
    <div className="border border-gold/30 rounded-lg p-6 mb-10 bg-gold/5">
      <p className="text-paper/80 mb-4">
        Create a free account and this (plus anything else you've bought) is always waiting in
        your library — no more hunting for this link.
      </p>
      <Link
        href={`/signup?email=${encodeURIComponent(buyerEmail ?? "")}&next=${encodeURIComponent("/library")}`}
        className="font-mono text-sm px-4 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90 inline-block"
      >
        Create free account
      </Link>
    </div>
  );
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;

  if (!sessionId) {
    return (
      <ErrorState message="We couldn't find your checkout session — if you just paid, check the link Stripe emailed you." />
    );
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    return (
      <ErrorState message="We couldn't find that checkout session. It may have expired." />
    );
  }

  // This is the actual proof of purchase — nothing below runs (and no
  // signed URL gets minted) unless Stripe confirms this specific session
  // was paid.
  if (session.payment_status !== "paid") {
    return (
      <ErrorState message="This purchase hasn't gone through yet. If you completed payment, give it a moment and refresh." />
    );
  }

  // presentment_details is only populated on a session Stripe Adaptive
  // Pricing actually converted for the buyer — the Stripe SDK's types don't
  // model it yet, hence the cast. No webhook/schema changes needed: this
  // reads straight off the live-retrieved session object above, and Fyby's
  // own charge currency/amount (session.currency/amount_total) and revenue
  // split are unaffected either way (see lib/currency.ts).
  const presentmentDetails = (session as any).presentment_details as
    | { presentment_amount: number; presentment_currency: string }
    | null
    | undefined;
  const chargedCurrency = session.currency ?? "usd";
  const paidInLocalCurrency = Boolean(
    presentmentDetails && presentmentDetails.presentment_currency.toLowerCase() !== chargedCurrency.toLowerCase()
  );

  const trackId = session.metadata?.track_id;
  const albumId = session.metadata?.album_id;

  if (!trackId && !albumId) {
    return <ErrorState message="This checkout session isn't linked to a track or album." />;
  }

  const admin = createServiceRoleClient();

  // Checkout requires login now (see app/actions/checkout.ts), so this is
  // normally already someone's own account — but a bookmarked /success link
  // from before that change (or a guest checkout that slipped through)
  // might land here logged out. Prompt them to create a free account so
  // this purchase (and any others under the same email) shows up
  // permanently in /library instead of only being reachable via this
  // one-time link — see app/actions/auth.ts for the matching-by-email claim
  // that runs on signup.
  const sessionSupabase = createClient();
  const {
    data: { user },
  } = await sessionSupabase.auth.getUser();
  const buyerEmail = session.customer_details?.email ?? null;

  if (albumId) {
    const { data: album } = await admin
      .from("albums")
      .select("id, title, artists ( profiles ( display_name ) )")
      .eq("id", albumId)
      .single();

    if (!album) {
      return <ErrorState message="That album is no longer available." />;
    }

    const { data: albumTrackRows } = await admin
      .from("album_tracks")
      .select("track_order, tracks ( id, title, audio_path, audio_url )")
      .eq("album_id", albumId)
      .order("track_order", { ascending: true });

    const tracks: TrackAudio[] = await Promise.all(
      (albumTrackRows ?? []).map(async (row) => {
        const track = row.tracks as any;
        return {
          id: track?.id,
          title: track?.title ?? "Untitled",
          downloadUrl: track ? await resolveDownloadUrl(admin, track) : null,
        };
      })
    );

    const artistName = (album as any).artists?.profiles?.display_name ?? "Unknown artist";

    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl text-gold mb-4">Thank you!</h1>
        <p className="text-paper/70 mb-2">
          The artist gets paid directly — not a fraction of a cent, but a real share of what you
          just paid.
        </p>
        <p className="text-paper/70 mb-10">
          <span className="font-display text-xl text-paper">{album.title}</span>
          <br />
          by {artistName}
        </p>

        {paidInLocalCurrency && presentmentDetails && (
          <LocalCurrencyNote
            presentmentAmount={presentmentDetails.presentment_amount}
            presentmentCurrency={presentmentDetails.presentment_currency}
            chargedAmount={session.amount_total ?? 0}
            chargedCurrency={chargedCurrency}
          />
        )}

        <div className="flex flex-col gap-4 mb-10">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="border border-paper/15 rounded-lg p-4 flex flex-col items-center gap-3 bg-paper/5"
            >
              <span className="font-display text-base">{track.title}</span>
              {track.downloadUrl ? (
                <>
                  <audio controls src={track.downloadUrl} className="w-full h-10" />
                  <a
                    href={track.downloadUrl}
                    download
                    className="font-mono text-xs px-3 py-2 rounded bg-gold text-ink font-medium hover:opacity-90"
                  >
                    Download track
                  </a>
                </>
              ) : (
                <p className="font-mono text-xs text-rust">
                  We couldn&apos;t find an audio file for this track. Contact the artist — your
                  purchase is recorded.
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="font-mono text-xs text-paper/50 mb-10">
          These links expire in an hour — bookmark this page to get fresh ones anytime.
        </p>

        {!user && <AccountPrompt buyerEmail={buyerEmail} />}

        <Link
          href="/"
          className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10"
        >
          Back to Fyby
        </Link>
      </main>
    );
  }

  const { data: track } = await admin
    .from("tracks")
    .select("id, title, audio_path, audio_url, cover_url, artists ( profiles ( display_name ) )")
    .eq("id", trackId)
    .single();

  if (!track) {
    return <ErrorState message="That track is no longer available." />;
  }

  const artistName = (track as any).artists?.profiles?.display_name ?? "Unknown artist";

  // Gift purchases (app/artists/[id]/BuyTrackForm.tsx's toggle) don't hand
  // the buyer a download/stream link here — the whole point is that the
  // *recipient* claims access at /gift/[token], not the person who paid.
  // See the is_gift branch in app/api/webhooks/stripe/route.ts.
  const isGift = session.metadata?.is_gift === "true";
  const giftRecipientEmail = session.metadata?.gift_recipient_email ?? null;
  const downloadUrl = isGift ? null : await resolveDownloadUrl(admin, track);

  // Best-effort lookup for the shareable receipt image (app/receipt/
  // [purchaseId]/route.tsx) — the webhook that inserts this purchase row can
  // still be in flight when this page first renders (Stripe's redirect and
  // its webhook delivery aren't ordered against each other), so this simply
  // doesn't render the share section rather than blocking on it.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let purchaseId: string | null = null;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;
  if (paymentIntentId) {
    const { data: purchaseRow } = await admin
      .from("purchases")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .eq("track_id", trackId)
      .maybeSingle();
    purchaseId = (purchaseRow as any)?.id ?? null;
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-3xl text-gold mb-4">
        {isGift ? "Gift sent! 🎁" : "Thank you!"}
      </h1>
      <p className="text-paper/70 mb-2">
        The artist gets paid directly — not a fraction of a cent, but a real share of what you
        just paid.
      </p>
      <p className="text-paper/70 mb-10">
        <span className="font-display text-xl text-paper">{track.title}</span>
        <br />
        by {artistName}
      </p>

      {paidInLocalCurrency && presentmentDetails && (
        <LocalCurrencyNote
          presentmentAmount={presentmentDetails.presentment_amount}
          presentmentCurrency={presentmentDetails.presentment_currency}
          chargedAmount={session.amount_total ?? 0}
          chargedCurrency={chargedCurrency}
        />
      )}

      {isGift ? (
        <div className="border border-gold/30 rounded-lg p-6 mb-10 bg-gold/5">
          <p className="text-paper/80">
            We&apos;ve sent {giftRecipientEmail ?? "your recipient"} an email with a link to claim
            this track — they&apos;ll create a free account (or log in) and it&apos;s theirs to
            keep.
          </p>
        </div>
      ) : downloadUrl ? (
        <div className="border border-paper/15 rounded-lg p-6 mb-10 flex flex-col items-center gap-4 bg-paper/5">
          <audio controls src={downloadUrl} className="w-full h-10" />
          <a
            href={downloadUrl}
            download
            className="font-mono text-sm px-4 py-2.5 rounded bg-gold text-ink font-medium hover:opacity-90"
          >
            Download track
          </a>
          <p className="font-mono text-xs text-paper/50">
            This link expires in an hour — bookmark this page to get a fresh one anytime.
          </p>
        </div>
      ) : (
        <p className="font-mono text-sm text-rust mb-10">
          We couldn&apos;t find an audio file for this track. Contact the artist — your purchase
          is recorded.
        </p>
      )}

      {purchaseId && <ShareReceiptSection purchaseId={purchaseId} siteUrl={siteUrl} />}

      {!user && <AccountPrompt buyerEmail={buyerEmail} />}

      <Link
        href="/"
        className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10"
      >
        Back to Fyby
      </Link>
    </main>
  );
}
