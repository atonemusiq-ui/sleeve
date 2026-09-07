"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripe } from "@/lib/stripe/server";
import { VIDEO_TIER_OPTIONS, tierAllows, type VideoTier } from "@/lib/videoTiers";
import { parseVideoEmbedUrl } from "@/lib/videoEmbed";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// A one-time Fyby platform fee, not an artist sale — this money stays in
// Fyby's own Stripe balance (no transfer_data / connected-account split,
// unlike app/actions/checkout.ts), so it's the plainest possible Checkout
// session. The webhook (app/api/webhooks/stripe/route.ts) unlocks the tier
// on `checkout.session.completed` by matching metadata.type ===
// "video_unlock", the same way it already branches on track vs. album
// purchases.
export async function startVideoUnlockCheckout(formData: FormData) {
  const tier = formData.get("tier") as string;
  const option = VIDEO_TIER_OPTIONS.find((o) => o.value === tier);
  if (!option) {
    throw new Error("Invalid video tier.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent(
        "Log in to unlock the video feature."
      )}&next=${encodeURIComponent("/dashboard")}`
    );
  }

  const { data: artist } = await supabase.from("artists").select("id").eq("user_id", user.id).single();
  if (!artist) {
    throw new Error("Could not find your artist profile.");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: option.priceCents,
          product_data: {
            name: `Fyby bio video — ${option.label}`,
            description: option.description,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/dashboard?videoUnlocked=1`,
    cancel_url: `${siteUrl}/dashboard`,
    metadata: {
      type: "video_unlock",
      artist_id: artist.id,
      tier: option.value,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}

export type SaveBioVideoResult = { error?: string };

// Covers both video entry methods. For an uploaded file, the file itself
// still uploads directly from the browser to the public "artist-videos"
// bucket (server actions don't take File objects well, same split as track
// cover art) — this takes the resulting URL either way and does the
// validated database write.
export async function saveBioVideo(formData: FormData): Promise<SaveBioVideoResult> {
  const videoType = formData.get("videoType") as string;
  const videoUrl = ((formData.get("videoUrl") as string) ?? "").trim();
  const contentAgreed = formData.get("contentAgreed") === "true";

  if (videoType !== "link" && videoType !== "upload") {
    return { error: "Invalid video type." };
  }
  if (!videoUrl) {
    return { error: "Please provide a video." };
  }
  if (!contentAgreed) {
    return { error: "You must confirm the content policy before adding a video." };
  }
  if (videoType === "link" && !parseVideoEmbedUrl(videoUrl)) {
    return { error: "That doesn't look like a YouTube or Vimeo link." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: artist, error: fetchError } = await supabase
    .from("artists")
    .select("id, video_tier")
    .eq("user_id", user.id)
    .single();

  if (fetchError || !artist) {
    return { error: "Could not find your artist profile." };
  }

  if (!tierAllows(artist.video_tier as VideoTier | null, videoType)) {
    return { error: "Unlock this video option first." };
  }

  const { error } = await supabase
    .from("artists")
    .update({
      bio_video_url: videoUrl,
      bio_video_type: videoType,
      video_content_agreed: true,
    })
    .eq("id", artist.id);

  if (error) {
    return { error: `Saving video failed: ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/artists/${artist.id}`);
  return {};
}

export async function removeBioVideo(): Promise<SaveBioVideoResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: artist, error: fetchError } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (fetchError || !artist) {
    return { error: "Could not find your artist profile." };
  }

  const { error } = await supabase
    .from("artists")
    .update({ bio_video_url: null, bio_video_type: null })
    .eq("id", artist.id);

  if (error) {
    return { error: `Removing video failed: ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/artists/${artist.id}`);
  return {};
}

export type ReportVideoResult = { ok?: boolean; error?: string };

// Anyone can report a video, logged in or not — this is the enforcement
// side of the content policy attestation in lib/videoPolicy.ts. Reports
// land in a queue only an admin can see (app/admin/videos/page.tsx); the
// reporter gets no confirmation beyond "thanks", intentionally, since this
// is a moderation signal rather than a support ticket.
export async function reportVideo(formData: FormData): Promise<ReportVideoResult> {
  const artistId = formData.get("artistId") as string;
  const videoUrl = (formData.get("videoUrl") as string) ?? null;

  if (!artistId) {
    return { error: "Missing artist." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("reported_videos").insert({
    artist_id: artistId,
    video_url: videoUrl,
  });

  if (error) {
    return { error: "Could not submit report." };
  }

  return { ok: true };
}
