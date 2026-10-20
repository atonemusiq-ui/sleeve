"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Home", icon: "🏠" },
  { href: "/admin/moderation", label: "Songs", icon: "🎵" },
  { href: "/admin/flagged", label: "Flagged", icon: "🚩" },
  { href: "/admin/videos", label: "Videos", icon: "🎬" },
  { href: "/admin/verifications", label: "Verified", icon: "✅" },
  { href: "/admin/genres", label: "Genres", icon: "🏷️" },
  { href: "/admin/ads", label: "Ads", icon: "📣" },
  { href: "/admin/fyby-tv", label: "Fyby TV", icon: "📺" },
];

// Scrolls sideways on a phone instead of wrapping into a tall block.
export default function AdminNavLinks() {
  const pathname = usePathname() ?? "/admin";
  return (
    <nav className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
      {ADMIN_SECTIONS.map((s) => {
        const active = s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-full border ${
              active ? "border-gold bg-gold text-ink" : "border-paper/20 text-paper/70 hover:border-gold/60 hover:text-gold"
            }`}
          >
            <span aria-hidden>{s.icon}</span>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
