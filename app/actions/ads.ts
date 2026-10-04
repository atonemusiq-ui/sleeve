"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripe } from "@/lib/stripe/server";
import { createNotification } from "@/lib/notifications";
import { isUuid } from "@/lib/uuid";
import {
  AD_CPM_CENTS,
  AD_MAX_BUDGET_CENTS,
  AD_MIN_BUDGET_CENTS,
  artistShareCents,
  cleanTargets,
  estimateReach,
  maxImpressionsFor,
  safeClickUrl,
} from "@/lib/ads";
import { revalidatePath } from "next/cache";

const ADMIN_EMAILS = ["atonemusiq@gmail.com"];

function targetsFrom(formData: FormData) {
  return cleanTargets({
    genres: formData.getAll("genres"),
    tags: formData.getAll("tags"),
    roles: formData.getAll("roles"),
  });
}

function text(formData: FormData, key: string, max: number): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// /advertise/new: live reach estimate while the advertiser picks targets.
export async function estimateAdReach(formData: FormData): Promise<{ reach: number | null; views: number }> {
  const budgetCents = Math.round(Number(formData.get("budget")) * 100) || 0;
  const reach = await estimateReach(targetsFrom(formData));
  return { reach, views: maxImpressionsFor(Math.max(0, budgetCents)) };
}

// /advertise/new: save the campaign and send the advertiser to Stripe to pay
// the budget up front. It goes to review once payment clears (webhook).
export async function startAdCampaign(formData: FormData): Promise<{ error: string } | { url: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Log in to create an ad." };

  const brandName = text(formData, "brandName", 60);
  const headline = text(formData, "headline", 80);
  const body = text(formData, "body", 160) || null;
  const clickUrl = safeClickUrl(text(formData, "clickUrl", 500));
  const imageUrl = text(formData, "imageUrl", 500) || null;
  const budgetCents = Math.round(Number(formData.get("budget")) * 100);

  if (!brandName) return { error: "Add your brand name." };
  if (!headline) return { error: "Add a headline." };
  if (!clickUrl) return { error: "Your link must start with https://" };
  const imagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ad-creatives/${user.id}/`;
  if (imageUrl && !imageUrl.startsWith(imagePrefix)) return { error: "Upload your image again." };
  if (!Number.isFinite(budgetCents) || budgetCents < AD_MIN_BUDGET_CENTS) return { error: "The minimum budget is $100." };
  if (budgetCents > AD_MAX_BUDGET_CENTS) return { error: "The maximum budget per campaign is $10,000." };

  const targets = targetsFrom(formData);
  const admin = createServiceRoleClient();
  const { data: campaign, error } = await admin
    .from("ad_campaigns")
    .insert({
      advertiser_id: user.id,
      brand_name: brandName,
      headline,
      body,
      click_url: clickUrl,
      image_url: imageUrl,
      target_genres: targets.genres,
      target_tags: targets.tags,
      target_roles: targets.roles,
      budget_cents: budgetCents,
      cpm_cents: AD_CPM_CENTS,
      max_impressions: maxImpressionsFor(budgetCents),
      status: "pending_payment",
    })
    .select("id")
    .single();
  if (error || !campaign) return { error: error?.message ?? "Could not save your ad." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    billing_address_collection: "required",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: budgetCents,
          product_data: {
            name: `Fyby sponsored card: ${brandName}`,
            description: `${maxImpressionsFor(budgetCents).toLocaleString("en-US")} views at $10 per 1,000. Reviewed before it runs; refunded if not approved.`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/advertise/campaigns?paid=1`,
    cancel_url: `${siteUrl}/advertise/campaigns`,
    metadata: { type: "ad_campaign", campaign_id: campaign.id },
  });

  await admin.from("ad_campaigns").update({ stripe_session_id: session.id }).eq("id", campaign.id);
  if (!session.url) return { error: "Stripe did not return a checkout link." };
  return { url: session.url };
}

// Advertiser pauses or restarts their own running campaign.
export async function setAdPaused(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = formData.get("campaignId");
  if (!user || !isUuid(id)) return;
  const pause = formData.get("pause") === "true";
  const admin = createServiceRoleClient();
  await admin
    .from("ad_campaigns")
    .update({ status: pause ? "paused" : "active" })
    .eq("id", id)
    .eq("advertiser_id", user.id)
    .eq("status", pause ? "active" : "paused");
  revalidatePath("/advertise/campaigns");
}

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) throw new Error("Not authorized.");
}

// /admin/ads: approve a paid campaign so it starts running.
export async function approveAdCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get("campaignId");
  if (!isUuid(id)) return;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("ad_campaigns")
    .update({ status: "active", approved_at: new Date().toISOString(), review_note: null })
    .eq("id", id)
    .eq("status", "in_review")
    .select("advertiser_id, brand_name")
    .maybeSingle();
  if (data) {
    await createNotification(admin, {
      userId: data.advertiser_id,
      type: "ad",
      title: "Your Fyby ad is live",
      body: `${data.brand_name}'s sponsored card was approved and is running now.`,
      link: "/advertise/campaigns",
    });
  }
  revalidatePath("/admin/ads");
}

// /admin/ads: reject a campaign and refund the advertiser in full.
export async function rejectAdCampaign(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get("campaignId");
  const note = (formData.get("note") as string | null)?.trim().slice(0, 300) || "Didn't meet Fyby's ad guidelines.";
  if (!isUuid(id)) return;
  const admin = createServiceRoleClient();
  const { data: c } = await admin
    .from("ad_campaigns")
    .select("id, advertiser_id, brand_name, stripe_payment_intent_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!c || c.status !== "in_review") return;

  let status = "rejected";
  if (c.stripe_payment_intent_id) {
    try {
      await stripe.refunds.create({ payment_intent: c.stripe_payment_intent_id });
      status = "refunded";
    } catch (err: any) {
      console.error(`Refund failed for ad campaign ${c.id}:`, err.message);
    }
  }
  await admin.from("ad_campaigns").update({ status, review_note: note }).eq("id", c.id);
  await createNotification(admin, {
    userId: c.advertiser_id,
    type: "ad",
    title: "Your Fyby ad wasn't approved",
    body: `${note}${status === "refunded" ? " Your payment has been refunded." : ""}`,
    link: "/advertise/campaigns",
  });
  revalidatePath("/admin/ads");
}

// /admin/ads: pay every artist their 30% of ads shown on their pages since
// their last payout (minimum $1), by Stripe transfer from Fyby's balance.
export async function payArtistAdShares(): Promise<void> {
  await requireAdmin();
  const admin = createServiceRoleClient();

  const { data: artists } = await admin.from("artists").select("id, user_id, stripe_account_id").not("stripe_account_id", "is", null);
  for (const a of artists ?? []) {
    const { data: last } = await admin
      .from("ad_artist_payouts")
      .select("impressions_through")
      .eq("artist_id", a.id)
      .order("impressions_through", { ascending: false })
      .limit(1)
      .maybeSingle();
    const after = last?.impressions_through ?? 0;

    const { data: newest } = await admin
      .from("ad_events")
      .select("id")
      .eq("artist_id", a.id)
      .eq("kind", "impression")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!newest || newest.id <= after) continue;

    const { count } = await admin
      .from("ad_events")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", a.id)
      .eq("kind", "impression")
      .gt("id", after)
      .lte("id", newest.id);
    const amount = artistShareCents(count ?? 0);
    if (amount < 100) continue;

    try {
      const transfer = await stripe.transfers.create({
        amount,
        currency: "usd",
        destination: a.stripe_account_id as string,
        transfer_group: `ad_share_${a.id}`,
        description: "Fyby ad share (30% of ads on your page)",
      });
      await admin.from("ad_artist_payouts").insert({
        artist_id: a.id,
        amount_cents: amount,
        impressions_through: newest.id,
        stripe_transfer_id: transfer.id,
      });
      await createNotification(admin, {
        userId: a.user_id,
        type: "ad",
        title: "You earned from ads on your page",
        body: `$${(amount / 100).toFixed(2)} (your 30% share) is on its way.`,
        link: "/dashboard",
      });
    } catch (err: any) {
      console.error(`Ad share transfer failed for artist ${a.id}:`, err.message);
    }
  }
  revalidatePath("/admin/ads");
}
