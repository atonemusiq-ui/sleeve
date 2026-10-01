"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { formatFybyDay, isFybyDay, nextFybyDay } from "@/lib/plans";

// Site-wide strip announcing Fyby Day (lib/plans.ts): 0% Fyby commission on
// the first Friday of every month. Computed in the browser after mount rather
// than on the server so a statically rendered page never shows yesterday's
// answer, and so server and client can't disagree during hydration.
export default function FybyDayBanner() {
  const pathname = usePathname() ?? "/";
  const [state, setState] = useState<{ today: boolean; next: string } | null>(null);

  useEffect(() => {
    setState({ today: isFybyDay(), next: nextFybyDay() });
  }, []);

  // The embeddable player runs inside other people's sites -- no banner there.
  if (!state || pathname.startsWith("/embed")) return null;

  if (state.today) {
    return (
      <div className="bg-flame text-ink text-center font-mono text-xs sm:text-sm px-4 py-2">
        <strong>It&apos;s Fyby Day!</strong> Fyby takes 0% today — every dollar you spend goes to the artist.
      </div>
    );
  }

  if (!state.next) return null;

  return (
    <div className="bg-paper/5 border-b border-paper/10 text-paper/70 text-center font-mono text-[11px] sm:text-xs px-4 py-1.5">
      Next <span className="text-gold">Fyby Day</span>: {formatFybyDay(state.next)} — Fyby takes 0%, artists keep
      every dollar.
    </div>
  );
}
