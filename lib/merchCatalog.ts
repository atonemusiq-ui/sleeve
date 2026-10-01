// The five Merch Booth products, mapped to real Printful catalog items.
//
// Variant ids and base costs were read from Printful's public catalog API
// (https://api.printful.com/products/<id>) on 2026-10-01. Costs are what
// Printful charges Fyby for the blank plus printing, before shipping. If
// Printful changes a price, update it here: the artist's payout is computed
// from these numbers.

export type MerchProductKey = "tee" | "hoodie" | "hat" | "tote" | "mug";

export type MerchVariant = {
  // Printful catalog variant id, sent as items[].variant_id on the order.
  id: number;
  size: string;
  costCents: number;
};

export type MerchCatalogItem = {
  key: MerchProductKey;
  label: string;
  printfulProductId: number;
  printfulName: string;
  // Printful file placement the artist's design goes on.
  fileType: string;
  // Recommended print file, shown to the artist when they upload.
  designTip: string;
  colors: Record<string, MerchVariant[]>;
};

export const MERCH_CATALOG: Record<MerchProductKey, MerchCatalogItem> = {
  tee: {
    key: "tee",
    label: "T-Shirt",
    printfulProductId: 71,
    printfulName: "Unisex Staple T-Shirt | Bella + Canvas 3001",
    fileType: "front",
    designTip: "PNG with a transparent background, at least 4500 × 5400 px.",
    colors: {
      Black: [
        { id: 9527, size: "XS", costCents: 1192 },
        { id: 4016, size: "S", costCents: 1192 },
        { id: 4017, size: "M", costCents: 1192 },
        { id: 4018, size: "L", costCents: 1192 },
        { id: 4019, size: "XL", costCents: 1192 },
        { id: 4020, size: "2XL", costCents: 1392 },
        { id: 5295, size: "3XL", costCents: 1592 },
        { id: 5310, size: "4XL", costCents: 1792 },
      ],
    },
  },
  hoodie: {
    key: "hoodie",
    label: "Hoodie",
    printfulProductId: 146,
    printfulName: "Unisex Heavy Blend Hoodie | Gildan 18500",
    fileType: "front",
    designTip: "PNG with a transparent background, at least 3600 × 3600 px.",
    colors: {
      Black: [
        { id: 5530, size: "S", costCents: 2263 },
        { id: 5531, size: "M", costCents: 2263 },
        { id: 5532, size: "L", costCents: 2263 },
        { id: 5533, size: "XL", costCents: 2263 },
        { id: 5534, size: "2XL", costCents: 2463 },
        { id: 5535, size: "3XL", costCents: 2663 },
      ],
    },
  },
  hat: {
    key: "hat",
    label: "Dad Hat",
    printfulProductId: 206,
    printfulName: "Classic Dad Hat | Yupoong 6245CM",
    // Printed on the front panel (Printful's "front_dtf_hat" placement)
    // rather than embroidered, so full-color designs work and no thread
    // colors have to be picked per order.
    fileType: "front_dtf_hat",
    designTip: "Logo-style PNG with a transparent background, wider than tall.",
    colors: {
      Black: [{ id: 7854, size: "One size", costCents: 1494 }],
      White: [{ id: 7853, size: "One size", costCents: 1494 }],
    },
  },
  tote: {
    key: "tote",
    label: "Tote Bag",
    printfulProductId: 367,
    printfulName: "Eco Tote Bag | Econscious EC8000",
    fileType: "front",
    designTip: "PNG with a transparent background, at least 3000 × 3000 px.",
    colors: {
      Black: [{ id: 10457, size: "One size", costCents: 1587 }],
      Oyster: [{ id: 10458, size: "One size", costCents: 1587 }],
    },
  },
  mug: {
    key: "mug",
    label: "Mug",
    printfulProductId: 19,
    printfulName: "White Glossy Mug",
    fileType: "default",
    designTip: "PNG at least 2700 × 1050 px; wraps around the mug.",
    colors: {
      White: [
        { id: 1320, size: "11 oz", costCents: 607 },
        { id: 4830, size: "15 oz", costCents: 811 },
      ],
    },
  },
};

export const MERCH_PRODUCT_KEYS = Object.keys(MERCH_CATALOG) as MerchProductKey[];

export function isMerchProductKey(value: unknown): value is MerchProductKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MERCH_CATALOG, value);
}

export function variantsFor(key: MerchProductKey, color: string): MerchVariant[] {
  return MERCH_CATALOG[key].colors[color] ?? [];
}

export function findVariant(key: MerchProductKey, color: string, variantId: number): MerchVariant | null {
  return variantsFor(key, color).find((v) => v.id === variantId) ?? null;
}

// The cheapest variant of a product/color: the "base size" the artist's
// price is set against.
export function baseCostCents(key: MerchProductKey, color: string): number {
  const costs = variantsFor(key, color).map((v) => v.costCents);
  return costs.length ? Math.min(...costs) : 0;
}

// What a fan pays for one unit of a variant: the artist's base price plus
// Printful's own upcharge for that size, so profit is the same on every size.
export function variantPriceCents(basePriceCents: number, key: MerchProductKey, color: string, variant: MerchVariant): number {
  return basePriceCents + (variant.costCents - baseCostCents(key, color));
}
