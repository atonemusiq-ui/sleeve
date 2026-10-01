"use server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { planOf } from "@/lib/plans";
import { isUuid } from "@/lib/uuid";
import {
  MERCH_CATALOG,
  baseCostCents,
  findVariant,
  isMerchProductKey,
  variantPriceCents,
} from "@/lib/merchCatalog";
import { merchCheckoutEnabled, merchShippingCents, merchSplit, minimumPriceCents, formatCents } from "@/lib/merch";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type MerchActionResult = { error?: string; success?: boolean };

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 500;
const MAX_QUANTITY = 10;

async function currentArtist() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, artist: null };

  const { data: artist } = await supabase
    .from("artists")
    .select("id, stripe_account_id, is_active, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, artist: artist as any };
}

function revalidateMerch(artistId: string) {
  revalidatePath("/dashboard/merch");
  revalidatePath("/merch");
  revalidatePath(`/artists/${artistId}`);
}

// Dashboard (app/dashboard/merch/MerchManager.tsx): list a new product. The
// design file is uploaded to the merch-designs bucket from the browser first;
// this only accepts a URL inside the artist's own folder of that bucket.
export async function createMerchProduct(formData: FormData): Promise<MerchActionResult> {
  const { supabase, artist } = await currentArtist();
  if (!artist) return { error: "You must be logged in as an artist." };

  if (!artist.stripe_account_id) {
    return { error: "Connect your bank account under Payouts first, so you can get paid for merch." };
  }

  const productKey = formData.get("productKey");
  const color = (formData.get("color") as string) ?? "";
  const title = ((formData.get("title") as string) ?? "").trim();
  const description = ((formData.get("description") as string) ?? "").trim() || null;
  const designUrl = ((formData.get("designUrl") as string) ?? "").trim();
  const priceDollars = Number(formData.get("price"));

  if (!isMerchProductKey(productKey)) return { error: "Pick a product." };
  if (!MERCH_CATALOG[productKey].colors[color]) return { error: "Pick a color." };
  if (!title) return { error: "Give your product a name." };
  if (title.length > MAX_TITLE) return { error: `Name is too long (max ${MAX_TITLE} characters).` };
  if (description && description.length > MAX_DESCRIPTION) {
    return { error: `Description is too long (max ${MAX_DESCRIPTION} characters).` };
  }

  const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/merch-designs/${artist.id}/`;
  if (!designUrl.startsWith(expectedPrefix)) return { error: "Upload your design file first." };

  if (!Number.isFinite(priceDollars)) return { error: "Enter a price." };
  const priceCents = Math.round(priceDollars * 100);
  const minimum = minimumPriceCents(baseCostCents(productKey, color));
  if (priceCents < minimum) {
    return { error: `The lowest price for this item is ${formatCents(minimum)}, so you make at least $5 on each one.` };
  }

  const { error } = await supabase.from("merch_products").insert({
    artist_id: artist.id,
    product_key: productKey,
    color,
    title,
    description,
    design_url: designUrl,
    price_cents: priceCents,
    active: true,
  });

  if (error) return { error: error.message };

  revalidateMerch(artist.id);
  return { success: true };
}

export async function setMerchProductActive(formData: FormData): Promise<MerchActionResult> {
  const { supabase, artist } = await currentArtist();
  if (!artist) return { error: "You must be logged in as an artist." };

  const productId = formData.get("productId");
  const active = formData.get("active") === "true";
  if (!isUuid(productId)) return { error: "Unknown product." };

  const { error } = await supabase
    .from("merch_products")
    .update({ active })
    .eq("id", productId)
    .eq("artist_id", artist.id);

  if (error) return { error: error.message };

  revalidateMerch(artist.id);
  return { success: true };
}

export async function updateMerchPrice(formData: FormData): Promise<MerchActionResult> {
  const { supabase, artist } = await currentArtist();
  if (!artist) return { error: "You must be logged in as an artist." };

  const productId = formData.get("productId");
  const priceDollars = Number(formData.get("price"));
  if (!isUuid(productId)) return { error: "Unknown product." };
  if (!Number.isFinite(priceDollars)) return { error: "Enter a price." };

  const { data: product } = await supabase
    .from("merch_products")
    .select("product_key, color")
    .eq("id", productId)
    .eq("artist_id", artist.id)
    .maybeSingle();
  if (!product || !isMerchProductKey(product.product_key)) return { error: "Unknown product." };

  const priceCents = Math.round(priceDollars * 100);
  const minimum = minimumPriceCents(baseCostCents(product.product_key, product.color));
  if (priceCents < minimum) {
    return { error: `The lowest price for this item is ${formatCents(minimum)}.` };
  }

  const { error } = await supabase
    .from("merch_products")
    .update({ price_cents: priceCents })
    .eq("id", productId)
    .eq("artist_id", artist.id);

  if (error) return { error: error.message };

  revalidateMerch(artist.id);
  return { success: true };
}

// The Buy button on a product page (app/merch/[productId]/BuyMerchForm.tsx).
// No account needed: merch ships to an address, so there's nothing to put
// in a library. A logged-in fan's id is still recorded so the order shows up
// for them.
export async function startMerchCheckout(formData: FormData) {
  const productId = formData.get("productId");
  const variantId = Number(formData.get("variantId"));
  const quantity = Math.floor(Number(formData.get("quantity") ?? 1));

  if (!isUuid(productId)) throw new Error("Unknown product.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error(`Choose a quantity from 1 to ${MAX_QUANTITY}.`);
  }
  if (!merchCheckoutEnabled()) {
    throw new Error("Merch checkout isn't open yet.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: product } = await supabase
    .from("merch_products")
    .select("id, title, product_key, color, price_cents, active, artist_id, artists ( is_active, plan, stripe_account_id, profiles ( display_name ) )")
    .eq("id", productId)
    .maybeSingle();

  const artist = (product as any)?.artists;
  if (!product || !product.active || !isMerchProductKey(product.product_key)) {
    throw new Error("This item isn't available right now.");
  }
  if (artist?.is_active === false || !artist?.stripe_account_id) {
    throw new Error("This item isn't available right now.");
  }

  const variant = findVariant(product.product_key, product.color, variantId);
  if (!variant) throw new Error("Pick a size.");

  const unitPriceCents = variantPriceCents(product.price_cents, product.product_key, product.color, variant);
  // The artist's plan when the fan paid, snapshotted like track sales are,
  // so the split the webhook pays out is the one shown at checkout.
  const plan = planOf(artist?.plan);
  const split = merchSplit(unitPriceCents, variant.costCents, quantity, plan);
  const shippingCents = merchShippingCents();
  const artistName = artist?.profiles?.display_name ?? "Fyby artist";
  const variantLabel = `${product.color} / ${variant.size}`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Same as track sales: off until the Stripe account has a tax origin
    // address set (see lib/checkoutSession.ts).
    automatic_tax: { enabled: false },
    shipping_address_collection: { allowed_countries: ["US"] },
    phone_number_collection: { enabled: true },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Standard shipping",
          fixed_amount: { amount: shippingCents, currency: "usd" },
          delivery_estimate: {
            minimum: { unit: "business_day", value: 5 },
            maximum: { unit: "business_day", value: 10 },
          },
        },
      },
    ],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: unitPriceCents,
          tax_behavior: "exclusive",
          product_data: {
            name: product.title,
            description: `${variantLabel} · by ${artistName}`,
          },
        },
        quantity,
      },
    ],
    success_url: `${siteUrl}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/merch/${product.id}`,
    metadata: {
      type: "merch",
      product_id: product.id,
      artist_id: product.artist_id,
      variant_id: String(variant.id),
      variant_label: variantLabel,
      quantity: String(quantity),
      unit_price_cents: String(unitPriceCents),
      unit_cost_cents: String(variant.costCents),
      shipping_cents: String(shippingCents),
      platform_fee_cents: String(split.platformFeeCents),
      artist_payout_cents: String(split.artistPayoutCents),
      plan,
      ...(user ? { fan_id: user.id } : {}),
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(session.url);
}
