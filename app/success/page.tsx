import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-3xl text-gold mb-4">Thank you!</h1>
      <p className="text-paper/70 mb-10">
        Your purchase went through. The artist gets paid directly — not a
        fraction of a cent, but a real share of what you just paid.
      </p>
      <Link
        href="/"
        className="font-mono text-sm px-4 py-2 rounded border border-gold/40 text-gold hover:bg-gold/10"
      >
        Back to Sleeve
      </Link>
    </main>
  );
}
