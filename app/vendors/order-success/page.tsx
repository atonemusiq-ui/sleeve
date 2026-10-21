import Link from "next/link";
import { stripe } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

// After paying for a vendor's product or service (app/actions/vendors.ts).
export default async function VendorOrderSuccessPage({ searchParams }: { searchParams: { session_id?: string } }) {
  let paid = false;
  let vendorId: string | null = null;
  let isService = false;
  if (searchParams.session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(searchParams.session_id);
      paid = session.payment_status === "paid";
      vendorId = session.metadata?.vendor_id ?? null;
      isService = !session.shipping_address_collection;
    } catch {
      // fall through to the generic message
    }
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-3xl text-gold mb-4">{paid ? "Thank you!" : "Almost there"}</h1>
      <p className="text-paper/70 mb-10">
        {paid
          ? isService
            ? "Your booking is confirmed. The vendor will contact you by email or phone to schedule."
            : "Your order is confirmed. The vendor will ship it to the address you entered, and Stripe has emailed your receipt."
          : "We couldn't confirm this payment yet. If you completed checkout, check your email for the receipt."}
      </p>
      <div className="flex justify-center gap-3">
        {vendorId && (
          <Link href={`/vendors/${vendorId}`} className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10">
            Back to the vendor
          </Link>
        )}
        <Link href="/vendors" className="font-mono text-sm px-4 py-2 rounded border border-paper/20 text-paper/70 hover:bg-paper/10">
          More vendors
        </Link>
      </div>
    </main>
  );
}
