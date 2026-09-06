import Link from "next/link";

// Shown only to logged-out visitors (see app/page.tsx) — closes the pitch
// with the two facts that matter most to a first-time visitor deciding
// whether to trust the platform with their music and their bank details.
export default function TrustFooter() {
  return (
    <section className="mt-4 mb-16 border-t border-paper/15 pt-10 text-center">
      <p className="font-mono text-xs text-paper/50 max-w-lg mx-auto">
        Artists keep 80% of every sale. Payments are processed securely through Stripe — Fyby
        never sees or stores your card details.
      </p>
      <Link
        href="/signup"
        className="inline-block mt-6 bg-gold text-ink font-mono text-sm font-medium rounded px-5 py-3 hover:opacity-90"
      >
        Start Selling
      </Link>
    </section>
  );
}
