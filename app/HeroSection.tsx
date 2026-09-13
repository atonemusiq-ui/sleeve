import Link from "next/link";
import ReceiptAnimation from "./ReceiptAnimation";

// Shown only to logged-out visitors (see app/page.tsx) — the marketing case
// for signing up as an artist. Logged-in users go straight to browsing.
export default function HeroSection() {
  return (
    <section className="mb-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
      <div className="animate-fade-rise">
        <p className="font-mono text-xs tracking-widest uppercase text-gold/80 mb-3">
          Welcome to Fyby
        </p>
        <h1 className="font-display text-4xl sm:text-5xl leading-tight text-paper">
          Sell your music.
          <br />
          <span className="text-gold">Keep the money.</span>
        </h1>
        <p className="text-paper/70 mt-5 max-w-md">
          Fyby lets you sell tracks and albums directly to fans — no label, no fraction of a
          cent per stream. You set the price, fans buy it once, and you keep the large
          majority of every sale. Whether it's your first upload or your fiftieth, you're
          always in the driver's seat here.
        </p>
        <Link
          href="/signup"
          className="inline-block mt-7 bg-gold text-ink font-mono text-sm font-medium rounded px-5 py-3 hover:opacity-90"
        >
          Start Selling
        </Link>
      </div>
      <ReceiptAnimation />
    </section>
  );
}
