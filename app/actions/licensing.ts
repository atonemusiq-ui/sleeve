"use server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { commissionCents, isFybyDay, payoutCents, planOf } from "@/lib/plans";
import { COVERS_GENRE } from "@/lib/genres";
import { isPreorder } from "@/lib/preorder";
import {
  LICENSE_TIERS,
  LICENSE_TIER_ORDER,
  MAX_LICENSEE_NAME_LENGTH,
  MAX_PROJECT_LENGTH,
  isLicenseTier,
  offeredTiers,
  parseTierPrice,
  type LicenseTier,
} from "@/lib/licensing";
import { isUuid } from "@/lib/uuid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type LicenseSettingsResult = { error?: string; success?: boolean };

// Artist side: switch licensing on/off for one of their tracks and set a
// price per tier (blank = tier not offered). Called from the catalog
// (app/dashboard/LicenseSettings.tsx).
export async function updateLicenseSettings(formData: FormData): Promise<LicenseSettingsResult> {
  const trackId = formData.get("trackId") as string;
  if (!isUuid(trackId)) return { error: "Track not found." };

  const enabled = formData.get("enabled") === "on" || formData.get("enabled") === "true";

  const prices: Partial<Record<LicenseTier, number | null>> = {};
  for (const tier of LICENSE_TIER_ORDER) {
    const parsed = parseTierPrice(tier, formData.get(tier) as string | null);
    if (parsed.error) return { error: parsed.error };
    prices[tier] = parsed.cents;
  }

  if (enabled && LICENSE_TIER_ORDER.every((t) => prices[t] == null)) {
    return { error: "Set a price for at least one license type, or turn licensing off." };
  }

  if (enabled && formData.get("rightsAttested") !== "on") {
    return {
      error:
        "Confirm you control the rights to license this song (and that everyone credited on it has agreed).",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };

  // Same two-step ownership check as app/actions/tracks.ts; RLS on tracks
  // enforces it again on the update itself.
  const { data: track } = await supabase
    .from("tracks")
    .select("artist_id, genre")
    .eq("id", trackId)
    .maybeSingle();
  if (!track) return { error: "Track not found." };

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("id", track.artist_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!artist) return { error: "That track isn't yours." };

  if (enabled && track.genre === COVERS_GENRE) {
    return { error: "Covers can't be licensed — the song belongs to its original writers." };
  }

  const { error } = await supabase
    .from("tracks")
    .update({
      license_enabled: enabled,
      license_beat_cents: prices.beat ?? null,
      license_standard_cents: prices.standard ?? null,
      license_commercial_cents: prices.commercial ?? null,
    })
    .eq("id", trackId);

  if (error) return { error: `Couldn't save licensing: ${error.message}` };

  revalidatePath("/dashboard/catalog");
  revalidatePath(`/artists/${track.artist_id}`);
  return { success: true };
}

// Buyer side: start a Stripe Checkout for one license tier on one track
// (the form on app/license/[trackId]/page.tsx). Everything the certificate
// needs rides in the session metadata; the webhook writes the
// license_purchases row once payment is confirmed.
export async function startLicenseCheckout(formData: FormData) {
  const trackId = formData.get("trackId") as string;
  const tier = formData.get("tier") as string;
  const licenseeName = ((formData.get("licenseeName") as string) ?? "").trim();
  const project = ((formData.get("project") as string) ?? "").trim();

  if (!isUuid(trackId)) throw new Error("Track not found.");
  if (!isLicenseTier(tier)) throw new Error("Pick a license type.");
  if (!licenseeName) throw new Error("Enter the name (or company) the license is for.");
  if (licenseeName.length > MAX_LICENSEE_NAME_LENGTH) {
    throw new Error(`Licensee name must be ${MAX_LICENSEE_NAME_LENGTH} characters or fewer.`);
  }
  if (project.length > MAX_PROJECT_LENGTH) {
    throw new Error(`Project description must be ${MAX_PROJECT_LENGTH} characters or fewer.`);
  }
  if (formData.get("agree") !== "on") throw new Error("You need to agree to the license terms.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent("Log in or sign up to license this song.")}&next=${encodeURIComponent(
        `/license/${trackId}`
      )}`
    );
  }

  const { data: track } = await supabase
    .from("tracks")
    .select(
      "id, title, genre, frozen, release_at, license_enabled, license_beat_cents, license_standard_cents, license_commercial_cents, artist_id, artists ( id, user_id, is_active, plan, profiles ( display_name ) )"
    )
    .eq("id", trackId)
    .maybeSingle();

  if (!track) throw new Error("Track not found.");
  const artist = (track as any).artists;
  if (!artist || artist.is_active === false || track.frozen) {
    throw new Error("This song isn't available to license right now.");
  }
  if (track.genre === COVERS_GENRE) throw new Error("Covers can't be licensed.");
  if (isPreorder((track as any).release_at)) {
    throw new Error("This song can be licensed once it's released.");
  }
  if (artist.user_id === user.id) throw new Error("You can't license your own song.");

  const offer = offeredTiers(track as any).find((o) => o.tier === tier);
  if (!offer) throw new Error("That license type isn't offered for this song.");

  const plan = planOf(artist.plan);
  const fybyDay = isFybyDay();
  const amountCents = offer.priceCents;
  const platformFeeCents = commissionCents(amountCents, plan, { fybyDay });
  const artistPayoutCents = payoutCents(amountCents, plan, { fybyDay });
  const artistName = artist.profiles?.display_name ?? "Unknown artist";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    billing_address_collection: "required",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `${LICENSE_TIERS[tier].label}: "${track.title}"`,
            description: `by ${artistName} — non-exclusive license for ${licenseeName}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/library?licensed=1`,
    cancel_url: `${siteUrl}/license/${track.id}`,
    metadata: {
      type: "license",
      track_id: track.id,
      artist_id: artist.id,
      buyer_id: user.id,
      tier,
      // Stripe caps each metadata value at 500 characters; both are bounded
      // well under that above.
      licensee_name: licenseeName,
      project_description: project,
      amount_cents: String(amountCents),
      platform_fee_cents: String(platformFeeCents),
      artist_payout_cents: String(artistPayoutCents),
      plan,
      ...(fybyDay ? { fyby_day: "true" } : {}),
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");

  redirect(session.url);
}
