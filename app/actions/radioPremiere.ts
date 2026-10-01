"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripe } from "@/lib/stripe/server";
import { planOf } from "@/lib/plans";
import {
  PREMIERE_TIERS,
  PRO_FREE_PREMIERE_EVERY_DAYS,
  PRO_FREE_PREMIERE_TIER,
  RADIO_EXCLUDED_GENRES,
  isPremiereTier,
} from "@/lib/radio";
import { premiereWindow } from "@/lib/radioPremiere";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DAY_MS = 24 * 60 * 60 * 1000;

async function proFreePremiereAvailable(artistId: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  const since = new Date(Date.now() - PRO_FREE_PREMIERE_EVERY_DAYS * DAY_MS).toISOString();
  const { count } = await admin
    .from("radio_premieres")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", artistId)
    .eq("amount_cents", 0)
    .gte("created_at", since);
  return (count ?? 0) === 0;
}

// Starts a Radio Premiere for one of the artist's own tracks
// (TrackList.tsx's premiere form). Paid tiers go through Stripe Checkout as a
// flat Fyby fee, the same pattern as app/actions/verification.ts; the
// webhook (app/api/webhooks/stripe/route.ts, type "radio_premiere") writes
// the premiere once payment is confirmed. A Pro artist's 7-day premiere is
// free once every 60 days (six a year) and is written immediately.
//
// Buying a premiere also turns Fyby Radio on for the track, since a premiere
// is by definition a request to play it on the radio.
export async function startRadioPremiere(formData: FormData) {
  const trackId = formData.get("trackId") as string;
  const tier = formData.get("tier");
  if (!isPremiereTier(tier)) throw new Error("Pick a premiere length.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent("Log in to premiere a song.")}&next=${encodeURIComponent(
        "/dashboard/catalog"
      )}`
    );
  }

  const { data: track } = await supabase
    .from("tracks")
    .select("id, title, genre, frozen, radio_opt_in, artist_id, artists ( id, user_id, plan )")
    .eq("id", trackId)
    .maybeSingle();
  const artist = track ? ((Array.isArray(track.artists) ? track.artists[0] : track.artists) as any) : null;
  if (!track || !artist || artist.user_id !== user.id) {
    throw new Error("That track doesn't belong to your account.");
  }
  if (track.frozen) throw new Error("This track was removed by an admin and can't be premiered.");
  if (RADIO_EXCLUDED_GENRES.includes(track.genre ?? "")) throw new Error("Covers can't play on Fyby Radio.");

  if (!track.radio_opt_in) {
    await supabase
      .from("tracks")
      .update({ radio_opt_in: true, radio_opted_in_at: new Date().toISOString() })
      .eq("id", trackId);
  }

  if (
    planOf(artist.plan) === "pro" &&
    tier === PRO_FREE_PREMIERE_TIER &&
    (await proFreePremiereAvailable(artist.id))
  ) {
    const window = await premiereWindow(trackId, tier);
    const { error } = await createServiceRoleClient().from("radio_premieres").insert({
      track_id: trackId,
      artist_id: artist.id,
      tier,
      starts_at: window.startsAt,
      ends_at: window.endsAt,
      amount_cents: 0,
    });
    if (error) throw new Error(`Starting the premiere failed: ${error.message}`);
    revalidatePath("/dashboard/catalog");
    redirect("/dashboard/catalog?premiereStarted=1");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const tierInfo = PREMIERE_TIERS[tier];

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: tierInfo.priceCents,
          product_data: {
            name: `Fyby Radio Premiere (${tierInfo.label}) — ${track.title}`,
            description: "Heavy rotation on Fyby Radio plus a spot in Premiering now on the homepage.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/dashboard/catalog?premiereStarted=1`,
    cancel_url: `${siteUrl}/dashboard/catalog`,
    metadata: {
      type: "radio_premiere",
      track_id: trackId,
      artist_id: artist.id,
      tier,
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(session.url);
}
