import type { Metadata } from "next";
import Link from "next/link";
import { stripe } from "@/lib/stripe/server";

export const metadata: Metadata = { title: "Order placed · Fyby Merch" };
export const dynamic = "force-dynamic";

// Stripe Checkout's success_url for merch (app/actions/merch.ts). The order
// itself is recorded by the webhook, which may land a moment after this
// page; so this only reads the Checkout Session to thank the fan.
export default async function MerchSuccessPage({ searchParams }: { searchParams: { session_id?: string } }) {
  let email: string | null = null;
  let itemName: string | null = null;

  const sessionId = searchParams.session_id;
  if (sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
      if (session.metadata?.type === "merch" && session.payment_status === "paid") {
        email = session.customer_details?.email ?? null;
        itemName = session.line_items?.data?.[0]?.description ?? null;
      }
    } catch {
      // Unknown or expired session: fall through to the generic thank-you.
    }
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-16 text-center flex flex-col items-center gap-5">
      <span className="font-mono text-xs tracking-widest uppercase px-3 py-1 rounded-full bg-flame text-ink font-medium">
        Order placed
      </span>
      <h1 className="font-display text-4xl font-bold">Thanks for supporting the artist</h1>
      <p className="text-paper/75 text-lg leading-relaxed">
        {itemName ? <strong>{itemName}</strong> : "Your merch"} is being printed just for you.
        {email ? ` We sent a confirmation to ${email}, and we'll email tracking when it ships.` : " We'll email tracking when it ships."}
      </p>
      <Link href="/merch" className="px-6 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold transition-colors">
        Back to the Merch Booth
      </Link>
    </main>
  );
}
