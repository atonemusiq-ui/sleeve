import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { trackNeedsCoverCredit } from "@/lib/coverCompliance";

export type CheckoutSessionResult = { url: string } | { error: string };

// Shared by app/actions/checkout.ts's startCheckout (the normal storefront
// Buy button, which redirect()s straight from the server action) and the
// embed widget's bounce route (app/embed/buy/[trackId]/route.ts). The embed
// route needs a plain top-level HTTP redirect rather than a client-
// intercepted server action, so a Buy click from inside an iframe on someone
// else's site can break out to the real Stripe checkout page (via a plain
// target="_top" link) instead of loading it squished inside the widget.
// Pulling the actual session-creation logic here means both paths enforce
// the same cover-compliance gate and build the same Stripe session, rather
// than maintaining two copies that could drift.
export async function createTrackCheckoutSession(
  trackId: string,
  userId: string
): Promise<CheckoutSessionResult> {
  const supabase = createClient();

  const { data: track, error } = await supabase
    .from("tracks")
    .select("id, title, price_cents, genre, frozen, artists ( is_active, profiles ( display_name ) )")
    .eq("id", trackId)
    .single();

  if (error || !track) {
    return { error: "Could not find that track." };
  }

  // A canceled artist (is_active = false — app/actions/artist.ts's
  // setArtistActive) shouldn't be buyable anywhere, including a stale embed
  // widget or a bookmarked artist link a fan still has lying around, even
  // though the storefront/artist-page queries already keep it from being
  // discoverable in the first place.
  if ((track as any).artists?.is_active === false) {
    return { error: "This track isn't available for purchase right now." };
  }

  // Same idea for a track an admin froze for a policy violation
  // (app/admin/moderation/page.tsx's freezeTrack) — the artist stays active,
  // just this one track is off-limits.
  if (track.frozen) {
    return { error: "This track is no longer available for purchase." };
  }

  // Cover songs owe the original songwriter/producer a royalty — see
  // lib/coverCompliance.ts — and can't be sold until the artist has credited
  // them as a contributor. Checked here, before a Stripe session (and any
  // money) exists, rather than after payment.
  if (await trackNeedsCoverCredit(track.id, track.genre)) {
    return {
      error:
        "This cover can't be purchased yet — the artist still needs to credit the original songwriter/producer before it can go on sale.",
    };
  }

  const artistName = (track as any).artists?.profiles?.display_name ?? "Unknown artist";

  const amountCents = track.price_cents;
  const platformFeeCents = Math.round(amountCents * 0.2);
  const artistPayoutCents = amountCents - platformFeeCents;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    phone_number_collection: {
      enabled: true,
    },
    // Collects sales tax on top of the listed price wherever the platform
    // has Stripe Tax registrations configured — requires Stripe Tax to be
    // turned on for this Stripe account first (Dashboard: Settings ->
    // Tax), with at least one registration added, or session creation fails
    // outright. billing_address_collection gives Stripe a real address to
    // calculate tax from for a purely digital good (no shipping address to
    // fall back on). tax_behavior: "exclusive" means amountCents (and this
    // app's platform-fee/artist-payout split, computed from it) stays the
    // pre-tax price — the tax Stripe adds rides on top of the charge, not
    // out of it.
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          tax_behavior: "exclusive",
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
      fan_id: userId,
      amount_cents: String(amountCents),
      platform_fee_cents: String(platformFeeCents),
      artist_payout_cents: String(artistPayoutCents),
    },
  });

  if (!session.url) {
    return { error: "Stripe did not return a checkout URL." };
  }

  return { url: session.url };
}
