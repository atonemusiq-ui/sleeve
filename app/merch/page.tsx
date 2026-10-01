import type { Metadata } from "next";
import Link from "next/link";

// getfyby.com/merch: the Merch Booth (Phase 10). This first version is the
// storefront layout only. Products are print-on-demand (Printful) and will be
// loaded from the database once artist merch listings and merch checkout are
// built; until then every item shows "Coming soon" instead of a buy button,
// so nothing on this page takes money it can't fulfil.
export const metadata: Metadata = {
  title: "Merch Booth · Fyby",
  description: "Artist merch, printed when you order and shipped to your door.",
};

type Product = {
  rank: string;
  name: string;
  detail: string;
  art: React.ReactNode;
};

// The five merch items fans buy most, in order.
const TOP_FIVE: Product[] = [
  { rank: "#1 Best seller", name: "T-Shirt", detail: "Heavyweight, boxy fit", art: <TeeArt /> },
  { rank: "#2 Top earner", name: "Hoodie", detail: "Embroidered or printed", art: <HoodieArt /> },
  { rank: "#3", name: "Hat", detail: "Dad hat, snapback or trucker", art: <HatArt /> },
  { rank: "#4", name: "Tote Bag", detail: "Everyday carry", art: <ToteArt /> },
  { rank: "#5", name: "Mug or Tumbler", detail: "Ceramic mug or steel tumbler", art: <DrinkArt /> },
];

export default function MerchPage() {
  return (
    <main className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 py-10 flex flex-col gap-12">
      {/* Drop of the Week */}
      <section
        aria-labelledby="drop-heading"
        className="grid md:grid-cols-2 gap-8 items-center rounded-3xl bg-ink/70 border border-paper/10 p-6 sm:p-10"
      >
        <div className="flex flex-col gap-4">
          <span className="self-start font-mono text-xs tracking-widest uppercase px-3 py-1 rounded-full bg-flame text-ink font-medium">
            Drop of the week
          </span>
          <h1 id="drop-heading" className="font-display text-4xl sm:text-5xl font-bold leading-tight">
            The Fyby Merch Booth
          </h1>
          <p className="text-paper/70 text-lg leading-relaxed max-w-md">
            Artist merch printed when you order and shipped to your door. Nothing sitting in a box
            backstage, and every purchase pays the artist directly.
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <span className="inline-flex items-center px-5 py-3 rounded-full border border-flame/60 text-flame font-medium">
              First drops coming soon
            </span>
          </div>
        </div>
        <div className="aspect-square rounded-2xl bg-[#100d16] flex items-center justify-center">
          <div className="w-3/4 h-3/4">
            <TeeArt />
          </div>
        </div>
      </section>

      {/* Top 5 */}
      <section aria-labelledby="top-heading" className="flex flex-col gap-6">
        <div>
          <h2 id="top-heading" className="font-display text-3xl font-bold">
            Shop the top 5
          </h2>
          <p className="text-paper/70 mt-1">What fans buy most. Every piece printed on demand.</p>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {TOP_FIVE.map((p) => (
            <li key={p.name} className="rounded-2xl bg-ink/70 border border-paper/10 p-3 flex flex-col gap-3">
              <div className="aspect-square rounded-xl bg-[#100d16] flex items-center justify-center">
                <div className="w-4/5 h-4/5">{p.art}</div>
              </div>
              <div className="px-1 flex flex-col gap-1">
                <span className="font-mono text-[11px] tracking-wider uppercase text-flame">{p.rank}</span>
                <h3 className="font-semibold text-lg leading-tight">{p.name}</h3>
                <span className="text-paper/60 text-sm">{p.detail}</span>
              </div>
              <span className="mt-auto mx-1 mb-1 font-mono text-xs text-paper/50">Coming soon</span>
            </li>
          ))}
        </ul>
        <p className="text-paper/60 text-sm">Plus stickers, added at checkout.</p>
      </section>

      {/* Fyby Radio tie-in */}
      <section
        aria-labelledby="radio-heading"
        className="flex flex-wrap items-center gap-5 rounded-2xl border border-paper/15 p-5 sm:p-6"
      >
        <div className="h-14 w-14 rounded-full bg-flame flex items-center justify-center shrink-0" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="#16121A" strokeWidth="2" strokeLinecap="round" className="h-7 w-7">
            <circle cx="12" cy="12" r="2" />
            <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" />
          </svg>
        </div>
        <div className="flex-1 min-w-[12rem]">
          <span className="font-mono text-xs tracking-widest uppercase text-flame">Hear it, then wear it</span>
          <h2 id="radio-heading" className="font-semibold text-xl">
            Shop the artist playing on Fyby Radio
          </h2>
        </div>
        <Link
          href="/radio"
          className="px-5 py-3 rounded-full bg-paper text-ink font-semibold hover:bg-gold transition-colors"
        >
          Open Fyby Radio
        </Link>
      </section>

      {/* For artists */}
      <section
        aria-labelledby="artists-heading"
        className="grid md:grid-cols-2 gap-6 items-center rounded-3xl bg-ink/70 border border-paper/10 p-6 sm:p-9"
      >
        <div className="flex flex-col gap-2">
          <h2 id="artists-heading" className="font-display text-2xl sm:text-3xl font-bold">
            Artists: sell merch without carrying a box of shirts
          </h2>
          <p className="text-paper/70 leading-relaxed">
            Upload a design, see your profit before you publish, and let fans order. Soon you&apos;ll
            also be able to make a 15-second commercial that plays on Fyby TV with a Shop Now button.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <span className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-flame/60 text-flame font-medium">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <path d="M3 9h18v11H3z" />
              <path d="m3 9 2-5h16l-2 5" />
              <path d="m8 4 2 5M13 4l2 5" />
            </svg>
            Make a Commercial · soon
          </span>
          <Link
            href="/dashboard"
            className="px-5 py-3 rounded-full bg-flame text-ink font-semibold hover:bg-gold transition-colors"
          >
            Go to my dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

// Simple product drawings, in the site's colors, until real Printful mockups
// replace them.
const SHIRT = "#2b2436";
const SHADE = "#3a3148";
const FLAME = "#FF5A36";
const INK = "#16121A";

function Art({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

function TeeArt() {
  return (
    <Art label="T-shirt">
      <path d="M40 22 28 28 14 44l12 10 8-8v54h52V46l8 8 12-10-14-16-12-6c-4 8-36 8-40 0Z" fill={SHIRT} />
      <circle cx="60" cy="58" r="13" fill={FLAME} />
      <path d="M56 52 66 58 56 64Z" fill={INK} />
    </Art>
  );
}

function HoodieArt() {
  return (
    <Art label="Hoodie">
      <path d="M44 20c0-6 32-6 32 0l14 8 16 18-12 10-8-8v56H34V48l-8 8-12-10 16-18Z" fill={SHIRT} />
      <path d="M46 20c2 14 26 14 28 0" fill="none" stroke={INK} strokeWidth="3" />
      <path d="M44 78h32v14H44z" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="60" cy="58" r="9" fill={FLAME} />
    </Art>
  );
}

function HatArt() {
  return (
    <Art label="Hat">
      <path d="M22 76c0-26 16-40 38-40s38 14 38 40Z" fill={SHIRT} />
      <path d="M60 76h46c4 0 6 8-2 10H60Z" fill={SHADE} />
      <path d="M60 36v40" stroke={INK} strokeWidth="2" />
      <circle cx="44" cy="58" r="8" fill={FLAME} />
    </Art>
  );
}

function ToteArt() {
  return (
    <Art label="Tote bag">
      <path d="M44 46c0-24 32-24 32 0" fill="none" stroke={SHADE} strokeWidth="5" />
      <rect x="28" y="44" width="64" height="62" rx="4" fill={SHIRT} />
      <circle cx="60" cy="76" r="14" fill="none" stroke={FLAME} strokeWidth="4" />
      <circle cx="60" cy="76" r="4" fill={FLAME} />
    </Art>
  );
}

function DrinkArt() {
  return (
    <Art label="Mug and tumbler">
      <path d="M24 50h36v44a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6Z" fill={SHIRT} />
      <path d="M60 58h6a10 10 0 0 1 0 20h-6" fill="none" stroke={SHIRT} strokeWidth="5" />
      <circle cx="42" cy="74" r="7" fill={FLAME} />
      <path d="M74 32h28l-4 70H78Z" fill={SHADE} />
      <rect x="72" y="26" width="32" height="8" rx="2" fill={SHIRT} />
      <path d="M94 26 98 12" stroke={FLAME} strokeWidth="3" strokeLinecap="round" />
    </Art>
  );
}
