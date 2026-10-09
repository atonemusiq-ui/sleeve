import type { Metadata } from "next";
import "./globals.css";
import GlobalAudioManager from "./GlobalAudioManager";
import SiteLogoBar from "./SiteLogoBar";
import FybyDayBanner from "./FybyDayBanner";
import RadioProvider from "./RadioProvider";
import PhaseSwitcher from "./PhaseSwitcher";
import { currentPhase, featureMap, isAdminRequest } from "@/lib/phaseServer";
import { livePhase } from "@/lib/phases";

export const metadata: Metadata = {
  title: "Fyby",
  description: "Direct-to-fan music sales. Artists keep the large majority of every sale.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Release phase for this request (lib/phases.ts) -- the live phase, or the
  // admin's investor-demo preview.
  const phase = currentPhase();
  const live = livePhase();
  const features = featureMap();
  const admin = isAdminRequest();

  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Unbounded:wght@800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-fyby text-paper font-body min-h-screen">
        {/* Enforces "only one song plays at a time" across the whole site —
            see GlobalAudioManager.tsx for how. Renders nothing itself. */}
        <GlobalAudioManager />
        {/* Fyby Radio (Phase 10) wraps every page so the music keeps playing
            across navigation. Hidden unless NEXT_PUBLIC_RADIO_ENABLED=true. */}
        <RadioProvider phaseAllows={features.radio}>
          <FybyDayBanner />
          <SiteLogoBar features={features} />
          {children}
        </RadioProvider>
        {/* Investor demo: click through each release phase. Admin only. */}
        {admin && <PhaseSwitcher phase={phase} livePhase={live} previewing={phase !== live} />}
      </body>
    </html>
  );
}
