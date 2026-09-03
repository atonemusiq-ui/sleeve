"use server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { redirect } from "next/navigation";

export async function startCheckout(formData: FormData) {
  const trackId = formData.get("trackId") as string;

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

  const { data: track, error } = await supabase
    .from("tracks")
    .select("id, title, price_cents, artists ( profiles ( display_name ) )")
    .eq("id", trackId)
    .single();

  if (error || !track) {
    throw new Error("Could not find that track.");
  }

  const artistName =
    (track as any).artists?.profiles?.display_name ?? "Unknown artist";

  const amountCents = track.price_cents;
  const platformFeeCents = Math.round(amountCents * 0.2);
  const artistPayoutCents = amountCents - platformFeeCents;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    phone_number_collection: {
      enabled: true,
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: track.title,
            description: `by ${artistName}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/`,
    metadata: {
      track_id: track.id,
      fan_id: user.id,
      amount_cents: String(amountCents),
      platform_fee_cents: String(platformFeeCents),
      artist_payout_cents: String(artistPayoutCents),
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}
