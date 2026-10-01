"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import FybyLogo, { FybyWordmark } from "./FybyLogo";

// Pages that already show the logo in their own header, plus the embeddable
// player (it runs inside other people's sites, so it stays unbranded here).
const HIDDEN_ON = ["/", "/login", "/signup"];

// The Fyby logo at the top of every page, linking back to the storefront.
export default function SiteLogoBar() {
  const pathname = usePathname() ?? "/";
  if (HIDDEN_ON.includes(pathname) || pathname.startsWith("/embed")) return null;

  return (
    <div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 pt-6 flex items-center justify-between gap-4">
      <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Fyby home">
        <FybyLogo className="h-7 w-7" />
        <FybyWordmark className="text-2xl" />
      </Link>
      <nav className="flex items-center gap-2">
      <Link
        href="/radio"
        className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-full border border-paper/20 text-paper/70 hover:border-gold/60 hover:text-gold"
      >
        📻 <span className="hidden sm:inline">Radio</span>
      </Link>
      <Link
        href="/tv"
        className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-full border border-paper/20 text-paper/70 hover:border-gold/60 hover:text-gold"
      >
        📺 <span className="hidden sm:inline">TV</span>
      </Link>
      <Link
        href="/merch"
        className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-full border border-paper/20 text-paper/70 hover:border-gold/60 hover:text-gold"
      >
        👕 <span className="hidden sm:inline">Merch</span>
      </Link>
      {/* The logo already links home; this makes that obvious. */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-full border border-paper/20 text-paper/70 hover:border-gold/60 hover:text-gold"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden>
          <path d="M3 9.5 10 3.5l7 6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 8.5V16.5h10V8.5" strokeLinejoin="round" />
        </svg>
        Home
      </Link>
      </nav>
    </div>
  );
}
