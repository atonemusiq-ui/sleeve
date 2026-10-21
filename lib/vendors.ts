import { VENDOR_PLAN } from "@/lib/plans";

// Plain (non-"use server") module shared by the vendor portal, the public
// Vendors page and checkout.

// The 25 categories a vendor can check on their profile, and the filters
// on the public Vendors page. Drawn from the most profitable small-business
// service categories (catering, cleaning, beauty, pet care...), the
// top-selling online product categories (apparel, wellness, custom-made,
// tech, pet products...) and what the music world on Fyby needs.
export const VENDOR_CATEGORIES = [
  { slug: "photography", label: "Photography", emoji: "📸" },
  { slug: "videography", label: "Videography & music videos", emoji: "🎥" },
  { slug: "dj", label: "DJ services", emoji: "🎧" },
  { slug: "catering", label: "Catering & private chef", emoji: "🍽️" },
  { slug: "baked-goods", label: "Cakes, baked goods & treats", emoji: "🎂" },
  { slug: "event-planning", label: "Event planning & decor", emoji: "🎉" },
  { slug: "party-rentals", label: "Party & equipment rentals", emoji: "🎪" },
  { slug: "live-entertainment", label: "Live entertainment & hosts", emoji: "🎤" },
  { slug: "studio", label: "Recording studio & production", emoji: "🎚️" },
  { slug: "instruments-gear", label: "Instruments & music gear", emoji: "🎸" },
  { slug: "graphic-design", label: "Graphic design & branding", emoji: "🎨" },
  { slug: "printing", label: "Printing & custom merch", emoji: "🖨️" },
  { slug: "apparel", label: "Clothing & apparel", emoji: "👕" },
  { slug: "jewelry", label: "Jewelry & accessories", emoji: "💍" },
  { slug: "hair-barber", label: "Hair & barber", emoji: "💈" },
  { slug: "makeup-nails", label: "Makeup, nails & beauty", emoji: "💅" },
  { slug: "skincare", label: "Skincare & beauty products", emoji: "🧴" },
  { slug: "wellness", label: "Health & wellness products", emoji: "🌿" },
  { slug: "fitness", label: "Fitness & personal training", emoji: "🏋️" },
  { slug: "art-prints", label: "Art, prints & photography prints", emoji: "🖼️" },
  { slug: "custom-made", label: "Handmade & custom-made", emoji: "🧵" },
  { slug: "home-decor", label: "Home decor & candles", emoji: "🕯️" },
  { slug: "tech", label: "Tech & electronics accessories", emoji: "🔌" },
  { slug: "cleaning", label: "Cleaning services", emoji: "🧽" },
  { slug: "pets", label: "Pet products & services", emoji: "🐾" },
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number]["slug"];

export function isVendorCategory(value: unknown): value is VendorCategory {
  return typeof value === "string" && VENDOR_CATEGORIES.some((c) => c.slug === value);
}

export function vendorCategoryLabel(slug: string): string {
  const c = VENDOR_CATEGORIES.find((c) => c.slug === slug);
  return c ? `${c.emoji} ${c.label}` : slug;
}

export const VENDOR_RATE_PERCENT = VENDOR_PLAN.rateBps / 100;

// The liner note shown at signup, on every product and at checkout.
export const VENDOR_BUYER_NOTE = "Sales tax and shipping are charged to the customer at checkout.";

// Who gets what from one vendor sale. Fyby's cut is taken from the item
// price only; shipping goes entirely to the vendor (they ship it), and
// sales tax is collected on top for the government.
export function vendorSplit(unitPriceCents: number, quantity: number, shippingPerItemCents: number) {
  const itemsCents = unitPriceCents * quantity;
  const shippingCents = shippingPerItemCents * quantity;
  const platformFeeCents = Math.round((itemsCents * VENDOR_PLAN.rateBps) / 10000);
  const vendorPayoutCents = itemsCents - platformFeeCents + shippingCents;
  return { itemsCents, shippingCents, platformFeeCents, vendorPayoutCents };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const MAX_VENDOR_PHOTOS = 6;
export const MAX_VENDOR_QUANTITY = 20;
