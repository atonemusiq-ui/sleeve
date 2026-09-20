"use server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/uuid";

// $9/month Super Fan subscription for one specific artist. Same inline
// price_data pattern as app/actions/checkout.ts's startAlbumCheckout, just
// mode: "subscription" with a recurring interval instead of mode: "payment"
// -- no pre-created Stripe Product/Price needed. The subscription row itself
// (artist_subscriptions) isn't written here; it's written by the dedicated
// webhook at app/api/webhooks/stripe-subscriptions/route.ts once Stripe
// confirms the subscription actually started, same division of labor as
// checkout.ts/the main webhook for one-time purchases.
export async function startSuperFanCheckout(formData: FormData) {
  const artistId = formData.get("artistId") as string;
  const rawReferredByFanId = (formData.get("referredByFanId") as string) || null;

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent(
        "Log in or sign up to become a Super Fan."
      )}&next=${encodeURIComponent(`/artists/${artistId}`)}`
    );
  }

  // The referral arrives from a `?ref=` link anyone can edit, and lands in a
  // `uuid references profiles(id)` column. A malformed value would fail the
  // insert inside the webhook, 500 the event, and leave this fan paying with
  // no artist_subscriptions row at all -- so anything that isn't a UUID is
  // dropped here rather than carried into Stripe metadata. Self-referral is
  // rejected for the same reason the page ignores it: credit is meant to be
  // paid out on this column, so a fan must not be able to name themselves by
  // posting to this action directly.
  const referredByFanId =
    isUuid(rawReferredByFanId) && rawReferredByFanId !== user.id ? rawReferredByFanId : null;

  const { data: artist, error } = await supabase
    .from("artists")
    .select("id, is_active, profiles ( display_name )")
    .eq("id", artistId)
    .single();

  if (error || !artist) {
    throw new Error("Could not find that artist.");
  }

  if ((artist as any).is_active === false) {
    throw new Error("This artist isn't available for Super Fan support right now.");
  }

  const { data: existing } = await supabase
    .from("artist_subscriptions")
    .select("id, status")
    .eq("fan_id", user.id)
    .eq("artist_id", artistId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    throw new Error("You're already a Super Fan of this artist.");
  }

  const artistName = (artist as any).profiles?.display_name ?? "this artist";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    billing_address_collection: "required",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: 900,
          recurring: { interval: "month" },
          product_data: {
            name: `Super Fan -- ${artistName}`,
            // Shown to the fan on Stripe's own checkout page, so it carries
            // the same promise the artist page makes. Kept to what Fyby
            // actually delivers today: the perks aren't built, so they aren't
            // sold here either. See the matching note in
            // app/artists/[id]/SupportArtist.tsx.
            description:
              "Direct monthly support for this artist — they keep 80%. Member perks are still being built and aren't included yet. Cancel any time.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/artists/${artistId}?superfan=success`,
    cancel_url: `${siteUrl}/artists/${artistId}`,
    subscription_data: {
      metadata: {
        type: "superfan_subscription",
        artist_id: artistId,
        fan_id: user.id,
        ...(referredByFanId ? { referred_by_fan_id: referredByFanId } : {}),
      },
    },
    metadata: {
      type: "superfan_subscription",
      artist_id: artistId,
      fan_id: user.id,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}

const MAX_GIFT_DOLLARS = 10000;

// A one-time monetary gift straight to the artist, separate from buying a
// track/album or subscribing. Same shape as startCheckout in checkout.ts,
// but the amount is fan-chosen rather than one of the fixed track/album
// price tiers. Recorded by the existing one-time-purchase webhook (app/api/
// webhooks/stripe/route.ts) since it's a mode: "payment" session like any
// other purchase, not a subscription.
export async function startGiftCheckout(formData: FormData) {
  const artistId = formData.get("artistId") as string;
  const amountDollars = Number(formData.get("amount"));
  const message = (formData.get("message") as string) || null;

  if (!Number.isFinite(amountDollars) || amountDollars < 1) {
    throw new Error("Enter a gift amount of at least $1.");
  }

  // A gift is transferred out to the artist's connected account as soon as
  // the charge lands, and a later refund or lost dispute can only claw it
  // back if that account still holds the funds. A ceiling keeps the worst
  // case bounded -- a stolen card sending one enormous gift to an account
  // that cashes out before the chargeback arrives.
  if (amountDollars > MAX_GIFT_DOLLARS) {
    throw new Error(`The most you can send in one gift is $${MAX_GIFT_DOLLARS.toLocaleString()}.`);
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent(
        "Log in or sign up to send a gift."
      )}&next=${encodeURIComponent(`/artists/${artistId}`)}`
    );
  }

  const { data: artist, error } = await supabase
    .from("artists")
    .select("id, user_id, is_active, profiles ( display_name )")
    .eq("id", artistId)
    .single();

  if (error || !artist) {
    throw new Error("Could not find that artist.");
  }

  if ((artist as any).is_active === false) {
    throw new Error("This artist isn't available to receive gifts right now.");
  }

  // SupportArtist.tsx hides the form from the artist themselves, but that is
  // a render-time choice and this is a plain POST endpoint anyone can call.
  // Gifting yourself would move platform money into your own connected
  // account on a card you can later dispute, so the rule is enforced here
  // too.
  if ((artist as any).user_id === user.id) {
    throw new Error("You can't send yourself a gift.");
  }

  const artistName = (artist as any).profiles?.display_name ?? "this artist";
  const amountCents = Math.round(amountDollars * 100);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    billing_address_collection: "required",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `Gift to ${artistName}`,
            ...(message ? { description: message.slice(0, 500) } : {}),
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/artists/${artistId}?gift=success`,
    cancel_url: `${siteUrl}/artists/${artistId}`,
    metadata: {
      type: "gift",
      artist_id: artistId,
      fan_id: user.id,
      amount_cents: String(amountCents),
      ...(message ? { gift_message: message.slice(0, 500) } : {}),
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}
