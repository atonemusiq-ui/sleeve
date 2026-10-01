"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripe } from "@/lib/stripe/server";
import { planOf } from "@/lib/plans";
import { isPremiereTier } from "@/lib/radio";
import { parseVideoEmbedUrl } from "@/lib/videoEmbed";
import { isUuid } from "@/lib/uuid";
import {
  ADMIN_TV_CATEGORIES,
  MAX_PREMIERE_LEAD_DAYS,
  MAX_TV_DESCRIPTION_LENGTH,
  MAX_TV_TITLE_LENGTH,
  VIDEO_PREMIERE_TIERS,
  type TvCategory,
} from "@/lib/fybyTv";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Same one-person allowlist as the other admin pages (app/admin/*).
const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

export type TvActionResult = { error?: string };

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    throw new Error("Only Fyby admins can manage Fyby TV.");
  }
}

function cleanText(value: FormDataEntryValue | null, max: number): string | null {
  const text = (typeof value === "string" ? value : "").trim();
  if (!text) return null;
  return text.slice(0, max);
}

// /admin/fyby-tv: add one of Fyby's own videos (What's New / How-To).
export async function addTvVideo(formData: FormData): Promise<TvActionResult> {
  await requireAdmin();
  const category = formData.get("category") as TvCategory;
  const title = cleanText(formData.get("title"), MAX_TV_TITLE_LENGTH);
  const description = cleanText(formData.get("description"), MAX_TV_DESCRIPTION_LENGTH);
  const videoUrl = ((formData.get("videoUrl") as string) ?? "").trim();
  const sortOrder = Number.parseInt((formData.get("sortOrder") as string) || "0", 10) || 0;

  if (!ADMIN_TV_CATEGORIES.includes(category)) return { error: "Pick What's New or How-To." };
  if (!title) return { error: "Add a title." };
  if (!parseVideoEmbedUrl(videoUrl)) return { error: "Paste a YouTube or Vimeo link." };

  const { error } = await createServiceRoleClient().from("fyby_tv_videos").insert({
    category,
    title,
    description,
    video_url: videoUrl,
    sort_order: sortOrder,
  });
  if (error) return { error: `Saving failed: ${error.message}` };

  revalidatePath("/admin/fyby-tv");
  revalidatePath("/");
  return {};
}

export async function setTvVideoPublished(id: string, published: boolean): Promise<TvActionResult> {
  await requireAdmin();
  if (!isUuid(id)) return { error: "Unknown video." };
  const { error } = await createServiceRoleClient().from("fyby_tv_videos").update({ published }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/fyby-tv");
  revalidatePath("/");
  return {};
}

export async function deleteTvVideo(id: string): Promise<TvActionResult> {
  await requireAdmin();
  if (!isUuid(id)) return { error: "Unknown video." };
  const { error } = await createServiceRoleClient()
    .from("fyby_tv_videos")
    .delete()
    .eq("id", id)
    .neq("category", "premiere"); // paid premieres are unpublished, never deleted
  if (error) return { error: error.message };
  revalidatePath("/admin/fyby-tv");
  revalidatePath("/");
  return {};
}

// Dashboard: a Pro artist buys a Video Premiere on Fyby TV. Paid through
// Stripe Checkout as a flat Fyby fee (same pattern as Radio Premieres); the
// webhook (app/api/webhooks/stripe/route.ts, type "video_premiere") writes
// the fyby_tv_videos row once payment is confirmed.
export async function startVideoPremiere(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent("Log in to premiere a video.")}&next=${encodeURIComponent(
        "/dashboard/catalog"
      )}`
    );
  }

  const { data: artist } = await supabase.from("artists").select("id, plan").eq("user_id", user.id).maybeSingle();
  if (!artist) throw new Error("Only artists can premiere videos.");
  if (planOf(artist.plan) !== "pro") {
    throw new Error("Video Premieres on Fyby TV are part of the Pro plan.");
  }

  const tier = formData.get("tier");
  if (!isPremiereTier(tier)) throw new Error("Pick a premiere length.");

  const title = cleanText(formData.get("title"), MAX_TV_TITLE_LENGTH);
  if (!title) throw new Error("Give your video a title.");
  const description = cleanText(formData.get("description"), MAX_TV_DESCRIPTION_LENGTH);

  const videoUrl = ((formData.get("videoUrl") as string) ?? "").trim();
  if (!parseVideoEmbedUrl(videoUrl)) throw new Error("Paste a YouTube or Vimeo link to your video.");

  // Optional: the song to sell under the video. Must be the artist's own.
  const rawTrackId = (formData.get("trackId") as string) || "";
  let trackId: string | null = null;
  if (rawTrackId) {
    if (!isUuid(rawTrackId)) throw new Error("Pick one of your songs.");
    const { data: track } = await supabase
      .from("tracks")
      .select("id")
      .eq("id", rawTrackId)
      .eq("artist_id", artist.id)
      .maybeSingle();
    if (!track) throw new Error("That song isn't one of yours.");
    trackId = track.id;
  }

  // Optional start time for a countdown; blank means start right away.
  const rawStart = (formData.get("startsAt") as string) || "";
  let startsAt = new Date();
  if (rawStart) {
    const parsed = new Date(rawStart);
    const latest = Date.now() + MAX_PREMIERE_LEAD_DAYS * 24 * 60 * 60 * 1000;
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() > latest) {
      throw new Error(`Pick a start time within the next ${MAX_PREMIERE_LEAD_DAYS} days.`);
    }
    startsAt = parsed;
  }

  const tierInfo = VIDEO_PREMIERE_TIERS[tier];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Stripe metadata values are capped at 500 characters, which the title,
  // description and URL limits stay well inside.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: tierInfo.priceCents,
          product_data: {
            name: `Fyby TV Video Premiere (${tierInfo.label}) — ${title}`,
            description: "Your music video featured in the Premieres channel on the Fyby homepage.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/dashboard/catalog?videoPremiere=1`,
    cancel_url: `${siteUrl}/dashboard/catalog`,
    metadata: {
      type: "video_premiere",
      artist_id: artist.id,
      tier,
      title,
      description: description ?? "",
      video_url: videoUrl.slice(0, 500),
      track_id: trackId ?? "",
      starts_at: startsAt.toISOString(),
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(session.url);
}
