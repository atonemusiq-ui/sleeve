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
    <div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-6 lg:px-8 pt-6">
      <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Fyby home">
        <FybyLogo className="h-7 w-7" />
        <FybyWordmark className="text-2xl" />
      </Link>
    </div>
  );
}
