"use server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { VERIFICATION_FEE_CENTS } from "@/lib/verification";
import { redirect } from "next/navigation";

// A one-time Fyby platform fee, same pattern as app/actions/video.ts's
// startVideoUnlockCheckout — stays in Fyby's own Stripe balance, no
// transfer_data/connected-account split. The webhook
// (app/api/webhooks/stripe/route.ts) flips the track to 'pending' review on
// checkout.session.completed by matching metadata.type ===
// "track_verification", the same way it already branches on video_unlock
// and track/album purchases. Status only moves to 'pending' once Stripe
// confirms payment — never at this point, before checkout even happens.
//
// A rejected application isn't refunded automatically: the fee covers the
// review itself (reading the note, making a call), not a guaranteed badge.
// If that ever needs to change, it's a manual Stripe refund + a rejection
// reason field, not something this flow decides on its own.
export async function startVerificationCheckout(formData: FormData) {
  const trackId = formData.get("trackId") as string;
  const note = ((formData.get("note") as string) ?? "").trim();

  if (!note) {
    throw new Error("Describe the human involvement in this track before applying.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent(
        "Log in to apply for verification."
      )}&next=${encodeURIComponent("/dashboard/catalog")}`
    );
  }

  // Ownership check mirrors getOwnedTrackOrError in app/actions/contributors.ts.
  const { data: track } = await supabase
    .from("tracks")
    .select("id, title, verification_status, artists ( user_id )")
    .eq("id", trackId)
    .maybeSingle();

  if (!track || (track as any).artists?.user_id !== user.id) {
    throw new Error("That track doesn't belong to your account.");
  }

  if (track.verification_status === "pending") {
    throw new Error("This track already has a verification request pending review.");
  }
  if (track.verification_status === "approved") {
    throw new Error("This track is already verified.");
  }

  // Saved now, ahead of payment, so the note survives even if the artist
  // abandons checkout — trying again just overwrites it, and the webhook
  // doesn't need to round-trip form data through Stripe metadata (which has
  // a size limit a longer note could hit).
  await supabase.from("tracks").update({ verification_note: note }).eq("id", trackId);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: VERIFICATION_FEE_CENTS,
          product_data: {
            name: `Verified Human+AI review — ${track.title}`,
            description: "One-time review fee for the Verified Human+AI badge.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/dashboard/catalog?verificationSubmitted=1`,
    cancel_url: `${siteUrl}/dashboard/catalog`,
    metadata: {
      type: "track_verification",
      track_id: trackId,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}
