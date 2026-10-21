"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripe } from "@/lib/stripe/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { siteOrigin } from "@/lib/siteUrl";
import { isUuid } from "@/lib/uuid";
import { VENDOR_PLAN } from "@/lib/plans";
import {
  MAX_VENDOR_PHOTOS,
  MAX_VENDOR_QUANTITY,
  VENDOR_BUYER_NOTE,
  VENDOR_RATE_PERCENT,
  isVendorCategory,
  vendorSplit,
} from "@/lib/vendors";

// Fyby Vendors (lib/vendors.ts). Vendor tables only have read policies
// (supabase/vendors.sql), so every write here checks ownership against the
// signed-in user first and then writes with the service-role client.

export type VendorActionResult = { error?: string; success?: boolean; id?: string };

async function ownVendor() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Please log in to your vendor account." };

  const admin = createServiceRoleClient();
  const { data: vendor } = await admin
    .from("vendors")
    .select("id, user_id, plan_status, plan_subscription_id, stripe_account_id, business_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vendor) return { ok: false as const, error: "No vendor account found for your login." };
  return { ok: true as const, user, vendor, admin };
}

function cleanUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function dollarsToCents(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// Images are uploaded straight from the browser to the public
// "vendor-images" bucket under "<vendor_id>/..."; only accept URLs that
// point there, inside this vendor's own folder.
function ownImageUrls(raw: string[], vendorId: string): string[] {
  const prefix = `/storage/v1/object/public/vendor-images/${vendorId}/`;
  return raw
    .map((u) => u.trim())
    .filter((u) => {
      try {
        return new URL(u).pathname.startsWith(prefix);
      } catch {
        return false;
      }
    })
    .slice(0, MAX_VENDOR_PHOTOS);
}

export async function updateVendorProfile(formData: FormData): Promise<VendorActionResult> {
  const owned = await ownVendor();
  if (!owned.ok) return { error: owned.error };
  const { vendor, admin } = owned;

  const businessName = String(formData.get("businessName") ?? "").trim();
  if (!businessName) return { error: "Please enter your business name." };
  if (businessName.length > 80) return { error: "Business name must be 80 characters or fewer." };

  const websiteRaw = String(formData.get("websiteUrl") ?? "");
  const websiteUrl = cleanUrl(websiteRaw);
  if (websiteRaw.trim() && !websiteUrl) return { error: "That website link doesn't look right." };

  const categories = formData.getAll("categories").map(String).filter(isVendorCategory);
  if (categories.length === 0) return { error: "Check at least one thing you do." };

  const logoUrls = ownImageUrls([String(formData.get("logoUrl") ?? "")], vendor.id);

  const { error } = await admin
    .from("vendors")
    .update({
      business_name: businessName,
      tagline: String(formData.get("tagline") ?? "").trim().slice(0, 120) || null,
      bio: String(formData.get("bio") ?? "").trim().slice(0, 2000) || null,
      city: String(formData.get("city") ?? "").trim().slice(0, 80) || null,
      website_url: websiteUrl,
      categories,
      ...(logoUrls[0] ? { logo_url: logoUrls[0] } : {}),
    })
    .eq("id", vendor.id);
  if (error) return { error: error.message };

  revalidatePath("/vendor");
  revalidatePath("/vendors");
  return { success: true };
}

export async function saveVendorProduct(formData: FormData): Promise<VendorActionResult> {
  const owned = await ownVendor();
  if (!owned.ok) return { error: owned.error };
  const { vendor, admin } = owned;

  const productId = formData.get("productId");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give your product or service a name." };
  if (title.length > 100) return { error: "Name must be 100 characters or fewer." };

  const kind = formData.get("kind") === "service" ? "service" : "product";
  const priceCents = dollarsToCents(formData.get("price"));
  if (priceCents === null || priceCents < 100) return { error: "Price must be at least $1.00." };
  if (priceCents > 10_000_00) return { error: "Price can't be more than $10,000." };

  const shippingCents = kind === "service" ? 0 : dollarsToCents(formData.get("shipping")) ?? 0;
  if (shippingCents > 500_00) return { error: "Shipping can't be more than $500 per item." };

  const imageUrls = ownImageUrls(formData.getAll("imageUrls").map(String), vendor.id);
  if (imageUrls.length === 0) return { error: "Add at least one photo." };

  const row = {
    vendor_id: vendor.id,
    title,
    description: String(formData.get("description") ?? "").trim().slice(0, 2000) || null,
    kind,
    price_cents: priceCents,
    shipping_cents: shippingCents,
    image_urls: imageUrls,
  };

  if (isUuid(productId)) {
    const { error } = await admin.from("vendor_products").update(row).eq("id", productId).eq("vendor_id", vendor.id);
    if (error) return { error: error.message };
    revalidatePath("/vendor");
    return { success: true, id: productId };
  }

  const { data, error } = await admin.from("vendor_products").insert(row).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/vendor");
  revalidatePath(`/vendors/${vendor.id}`);
  return { success: true, id: data.id };
}

export async function setVendorProductActive(formData: FormData): Promise<VendorActionResult> {
  const owned = await ownVendor();
  if (!owned.ok) return { error: owned.error };
  const productId = formData.get("productId");
  if (!isUuid(productId)) return { error: "Unknown product." };
  const { error } = await owned.admin
    .from("vendor_products")
    .update({ active: formData.get("active") === "true" })
    .eq("id", productId)
    .eq("vendor_id", owned.vendor.id);
  if (error) return { error: error.message };
  revalidatePath("/vendor");
  return { success: true };
}

export async function deleteVendorProduct(formData: FormData): Promise<VendorActionResult> {
  const owned = await ownVendor();
  if (!owned.ok) return { error: owned.error };
  const productId = formData.get("productId");
  if (!isUuid(productId)) return { error: "Unknown product." };
  const { error } = await owned.admin
    .from("vendor_products")
    .delete()
    .eq("id", productId)
    .eq("vendor_id", owned.vendor.id);
  if (error) return { error: error.message };
  revalidatePath("/vendor");
  return { success: true };
}

export async function markVendorOrderFulfilled(formData: FormData): Promise<VendorActionResult> {
  const owned = await ownVendor();
  if (!owned.ok) return { error: owned.error };
  const orderId = formData.get("orderId");
  if (!isUuid(orderId)) return { error: "Unknown order." };
  const { error } = await owned.admin
    .from("vendor_orders")
    .update({ status: "fulfilled" })
    .eq("id", orderId)
    .eq("vendor_id", owned.vendor.id)
    .eq("status", "paid");
  if (error) return { error: error.message };
  revalidatePath("/vendor");
  return { success: true };
}

// The required Vendor Pro plan. The vendor goes live once Stripe confirms
// the subscription (app/api/webhooks/stripe-subscriptions/route.ts).
export async function startVendorPlanCheckout() {
  const owned = await ownVendor();
  if (!owned.ok) {
    redirect(`/login?next=${encodeURIComponent("/vendor")}&error=${encodeURIComponent(owned.error)}`);
  }
  const { vendor, user } = owned;
  if (vendor.plan_status === "active") redirect("/vendor");

  const siteUrl = siteOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    billing_address_collection: "required",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: VENDOR_PLAN.priceCents,
          recurring: { interval: "month" },
          product_data: {
            name: `Fyby ${VENDOR_PLAN.label}`,
            description: `List your products and services on Fyby. ${VENDOR_RATE_PERCENT}% per sale. ${VENDOR_BUYER_NOTE}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/vendor?plan=success`,
    cancel_url: `${siteUrl}/vendor`,
    subscription_data: { metadata: { type: "vendor_plan_subscription", vendor_id: vendor.id } },
    metadata: { type: "vendor_plan_subscription", vendor_id: vendor.id },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(session.url);
}

export async function cancelVendorPlan(): Promise<VendorActionResult> {
  const owned = await ownVendor();
  if (!owned.ok) return { error: owned.error };
  const subscriptionId = owned.vendor.plan_subscription_id;
  if (!subscriptionId) return { error: "You don't have an active plan." };
  try {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  } catch (err: any) {
    return { error: err.message ?? "Couldn't cancel the plan." };
  }
  return { success: true };
}

// The Buy / Book button on a vendor's page. No Fyby account needed (like
// merch): Stripe collects the email, and the shipping address for a
// product. Shipping and sales tax go on top of the price for the buyer.
export async function startVendorCheckout(formData: FormData) {
  const productId = formData.get("productId");
  const quantity = Math.floor(Number(formData.get("quantity") ?? 1));
  if (!isUuid(productId)) throw new Error("Unknown product.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_VENDOR_QUANTITY) {
    throw new Error(`Choose a quantity from 1 to ${MAX_VENDOR_QUANTITY}.`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createServiceRoleClient();
  const { data: product } = await admin
    .from("vendor_products")
    .select(
      "id, title, kind, price_cents, shipping_cents, image_urls, active, frozen, vendor_id, vendors ( id, user_id, business_name, stripe_account_id, plan_status, is_active )"
    )
    .eq("id", productId)
    .maybeSingle();

  const vendor: any = Array.isArray((product as any)?.vendors) ? (product as any).vendors[0] : (product as any)?.vendors;
  if (!product || !product.active || product.frozen || !vendor) {
    throw new Error("This item isn't available right now.");
  }
  if (vendor.plan_status !== "active" || !vendor.is_active || !vendor.stripe_account_id) {
    throw new Error("This vendor isn't taking orders right now.");
  }
  if (vendor.user_id && user?.id === vendor.user_id) {
    throw new Error("You can't buy your own listing.");
  }

  const isService = product.kind === "service";
  const qty = isService ? 1 : quantity;
  const split = vendorSplit(product.price_cents, qty, isService ? 0 : product.shipping_cents);
  const siteUrl = siteOrigin();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Sales tax is added on top for the buyer once Stripe Tax is set up on
    // the Fyby Stripe account (tax origin address + registrations); until
    // then STRIPE_TAX_ENABLED stays unset so checkout doesn't fail.
    automatic_tax: { enabled: process.env.STRIPE_TAX_ENABLED === "true" },
    phone_number_collection: { enabled: true },
    ...(isService
      ? { billing_address_collection: "required" as const }
      : {
          shipping_address_collection: { allowed_countries: ["US" as const] },
          shipping_options: [
            {
              shipping_rate_data: {
                type: "fixed_amount" as const,
                display_name: `Shipping from ${vendor.business_name || "the vendor"}`,
                fixed_amount: { amount: split.shippingCents, currency: "usd" },
                tax_behavior: "exclusive" as const,
              },
            },
          ],
        }),
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: product.price_cents,
          tax_behavior: "exclusive",
          product_data: {
            name: product.title,
            description: `${isService ? "Service" : "Sold"} by ${vendor.business_name || "a Fyby vendor"}. ${VENDOR_BUYER_NOTE}`,
            ...(product.image_urls?.[0] ? { images: [product.image_urls[0]] } : {}),
          },
        },
        quantity: qty,
      },
    ],
    success_url: `${siteUrl}/vendors/order-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/vendors/${vendor.id}`,
    metadata: {
      type: "vendor_order",
      product_id: product.id,
      vendor_id: vendor.id,
      quantity: String(qty),
      unit_price_cents: String(product.price_cents),
      shipping_cents: String(split.shippingCents),
      platform_fee_cents: String(split.platformFeeCents),
      vendor_payout_cents: String(split.vendorPayoutCents),
      ...(user ? { buyer_id: user.id } : {}),
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(session.url);
}
