"use server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { commissionCents, payoutCents, planOf } from "@/lib/plans";
import { trackNeedsCoverCredit } from "@/lib/coverCompliance";
import { createTrackCheckoutSession } from "@/lib/checkoutSession";
import { isUuid } from "@/lib/uuid";
import { redirect } from "next/navigation";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function startCheckout(formData: FormData) {
  const trackId = formData.get("trackId") as string;

  // Gift toggle (app/artists/[id]/BuyTrackForm.tsx): a recipient email means
  // this purchase should grant access to that inbox instead of the buyer's
  // own account — see the is_gift branch in lib/checkoutSession.ts and the
  // webhook. Silently ignored (treated as a normal purchase) if the field is
  // blank or not a plausible email, rather than erroring the whole checkout
  // over a malformed gift address.
  const rawGiftEmail = (formData.get("giftRecipientEmail") as string | null)?.trim() ?? "";
  const giftRecipientEmail = rawGiftEmail && isValidEmail(rawGiftEmail) ? rawGiftEmail : null;

  // Re-validated here even though app/artists/[id]/page.tsx already
  // shape-checks it before putting it in the form — a form post is never
  // the only way to reach a server action, so this can't trust the hidden
  // field on its own (same reasoning as startSuperFanCheckout's check in
  // app/actions/superfan.ts).
  const rawReferredBy = formData.get("referredByFanId") as string | null;
  const referredByFanId = rawReferredBy && isUuid(rawReferredBy) ? rawReferredBy : null;

  const supabase = createClient();

  // Buying requires an account now — that's what lets a completed purchase
  // show up in the buyer's own "My Music" library (app/library/page.tsx)
  // instead of only being reachable via the one-time /success link. Bounce
  // to login with a `next` back to the storefront so they land somewhere
  // with a working Buy button once they're signed in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent(
        "Log in or sign up to buy this track."
      )}&next=${encodeURIComponent("/")}`
    );
  }

  // Session creation itself (track lookup, cover-compliance gate, split math,
  // Stripe session) lives in lib/checkoutSession.ts so it's shared with the
  // embed widget's bounce route (app/embed/buy/[trackId]/route.ts) — see that
  // file's comment for why the embed path needs a plain HTTP redirect
  // instead of a redirect() thrown from inside a server action.
  const result = await createTrackCheckoutSession(trackId, user.id, {
    giftRecipientEmail,
    referredByFanId: referredByFanId && referredByFanId !== user.id ? referredByFanId : null,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  redirect(result.url);
}

// Same shape as startCheckout above, but for a whole album at its flat
// bundle price. The per-track revenue split (each track's share of
// amount/fee/payout, proportional to its own price_cents) happens in the
// webhook at fulfillment time (app/api/webhooks/stripe/route.ts) rather than
// here — the webhook re-reads album_tracks/tracks from the database at that
// point anyway, so there's no reason to duplicate that math into metadata
// that could drift from it.
export async function startAlbumCheckout(formData: FormData) {
  const albumId = formData.get("albumId") as string;

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent(
        "Log in or sign up to buy this album."
      )}&next=${encodeURIComponent("/")}`
    );
  }

  const { data: album, error } = await supabase
    .from("albums")
    .select("id, title, price_cents, artists ( is_active, plan, profiles ( display_name ) )")
    .eq("id", albumId)
    .single();

  if (error || !album) {
    throw new Error("Could not find that album.");
  }

  // See the matching check in lib/checkoutSession.ts — a canceled artist
  // (app/actions/artist.ts's setArtistActive) shouldn't be buyable via a
  // stale link even though the storefront already hides them.
  if ((album as any).artists?.is_active === false) {
    throw new Error("This album isn't available for purchase right now.");
  }

  const { data: albumTrackRows } = await supabase
    .from("album_tracks")
    .select("tracks ( id, title, genre, frozen )")
    .eq("album_id", albumId);

  if (!albumTrackRows || albumTrackRows.length === 0) {
    throw new Error("This album has no tracks.");
  }
  const trackCount = albumTrackRows.length;

  // Same cover-song gate as a single-track purchase (see
  // app/actions/checkout.ts's startCheckout and lib/coverCompliance.ts),
  // applied to every track in the bundle — one uncredited cover blocks the
  // whole album purchase rather than silently selling it anyway. Same idea
  // for a frozen track (app/admin/moderation/page.tsx's freezeTrack) — one
  // frozen track blocks the whole bundle rather than quietly selling the
  // rest around it.
  for (const row of albumTrackRows) {
    const track = row.tracks as any;
    if (track?.frozen) {
      throw new Error(`This album isn't available for purchase right now — "${track.title}" was removed.`);
    }
    if (track && (await trackNeedsCoverCredit(track.id, track.genre))) {
      throw new Error(
        `This album can't be purchased yet — "${track.title}" is a cover and still needs the original songwriter/producer credited before it can go on sale.`
      );
    }
  }

  const artistName = (album as any).artists?.profiles?.display_name ?? "Unknown artist";

  const amountCents = album.price_cents;
  // Same as the single-track path in lib/checkoutSession.ts: the artist's
  // plan sets the cut, and it is snapshotted into metadata so the per-track
  // split the webhook writes uses the same rate this total was built from.
  const plan = planOf((album as any).artists?.plan);
  const platformFeeCents = commissionCents(amountCents, plan);
  const artistPayoutCents = payoutCents(amountCents, plan);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    phone_number_collection: {
      enabled: true,
    },
    // See the matching comment in lib/checkoutSession.ts's
    // createTrackCheckoutSession — same Stripe Tax setup, same reasoning.
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          tax_behavior: "exclusive",
          product_data: {
            name: `${album.title} (full album, ${trackCount} tracks)`,
            description: `by ${artistName}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/`,
    metadata: {
      album_id: album.id,
      fan_id: user.id,
      amount_cents: String(amountCents),
      platform_fee_cents: String(platformFeeCents),
      artist_payout_cents: String(artistPayoutCents),
      plan,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}
