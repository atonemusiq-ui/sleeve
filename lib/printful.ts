// Minimal Printful API v1 client: create an order, cancel one. Plain fetch,
// no SDK (same reason as lib/email.ts: no package installs from here).
//
// PRINTFUL_API_KEY: a private token from Printful (Settings > API). When it
// isn't set, nothing is sent and callers get { mode: "test" } back, so the
// rest of the merch flow (checkout, order record, artist payout) can be run
// end to end in Stripe test mode before a Printful account exists.
//
// PRINTFUL_AUTO_CONFIRM: "true" sends orders straight to production. Left
// unset, orders arrive in Printful as drafts so the first ones can be
// checked and confirmed by hand in the Printful dashboard.

const PRINTFUL_API = "https://api.printful.com";

export type PrintfulRecipient = {
  name: string;
  address1: string;
  address2?: string | null;
  city: string;
  state_code?: string | null;
  country_code: string;
  zip: string;
  email?: string | null;
  phone?: string | null;
};

export type PrintfulOrderInput = {
  // Our merch_orders.id without dashes: exactly 32 characters, Printful's limit.
  externalId: string;
  recipient: PrintfulRecipient;
  variantId: number;
  quantity: number;
  fileType: string;
  fileUrl: string;
  retailPriceCents: number;
};

export type PrintfulResult =
  | { mode: "test" }
  | { mode: "live"; orderId: string }
  | { mode: "error"; message: string };

export function printfulConfigured(): boolean {
  return Boolean(process.env.PRINTFUL_API_KEY);
}

export function externalIdFor(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 32);
}

export async function createPrintfulOrder(input: PrintfulOrderInput): Promise<PrintfulResult> {
  const apiKey = process.env.PRINTFUL_API_KEY;
  if (!apiKey) return { mode: "test" };

  const confirm = process.env.PRINTFUL_AUTO_CONFIRM === "true";

  try {
    const res = await fetch(`${PRINTFUL_API}/orders?confirm=${confirm ? "true" : "false"}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: input.externalId,
        shipping: "STANDARD",
        recipient: input.recipient,
        items: [
          {
            variant_id: input.variantId,
            quantity: input.quantity,
            retail_price: (input.retailPriceCents / 100).toFixed(2),
            files: [{ type: input.fileType, url: input.fileUrl }],
          },
        ],
      }),
    });

    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      return { mode: "error", message: json?.error?.message ?? json?.result ?? `HTTP ${res.status}` };
    }
    return { mode: "live", orderId: String(json?.result?.id ?? "") };
  } catch (err: any) {
    return { mode: "error", message: err?.message ?? "Network error" };
  }
}

// Cancels an order that hasn't gone to production yet (a refunded sale).
// Printful refuses once printing has started; that's logged, not thrown.
export async function cancelPrintfulOrder(externalId: string): Promise<boolean> {
  const apiKey = process.env.PRINTFUL_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch(`${PRINTFUL_API}/orders/@${externalId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.error(`Printful refused to cancel order @${externalId} (HTTP ${res.status}) — it may already be printing.`);
    }
    return res.ok;
  } catch (err: any) {
    console.error(`Could not reach Printful to cancel order @${externalId}:`, err?.message);
    return false;
  }
}
