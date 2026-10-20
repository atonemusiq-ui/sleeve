import type { Metadata } from "next";
import "./globals.css";
import GlobalAudioManager from "./GlobalAudioManager";
import SiteLogoBar from "./SiteLogoBar";
import FybyDayBanner from "./FybyDayBanner";
import RadioProvider from "./RadioProvider";
import PhaseSwitcher from "./PhaseSwitcher";
import { currentPhase, featureMap, isAdminRequest } from "@/lib/phaseServer";
import { livePhase } from "@/lib/phases";
import { getLang } from "@/lib/i18n/server";
import { I18nProvider } from "./I18nProvider";
import AutoTranslate from "./AutoTranslate";
import { cookies } from "next/headers";
import { ADMIN_UI_COOKIE } from "@/lib/admin";

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
  // Shows the 🛡 Admin shortcut in the top bar. Only a convenience -- every
  // back-office page re-checks the admin team list itself.
  const showAdminLink = admin || cookies().has(ADMIN_UI_COOKIE);
  // Interface language (lib/i18n): the visitor's 🌐 pick, else their browser's.
  const lang = getLang();

  return (
    <html lang={lang} className={lang === "en" ? undefined : "fyby-translating"}>
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
        {lang !== "en" && (
          // Never leave the page hidden if the translator can't run.
          <script
            dangerouslySetInnerHTML={{
              __html: "setTimeout(function(){document.documentElement.classList.remove('fyby-translating')},2500)",
            }}
          />
        )}
        <I18nProvider lang={lang}>
          <AutoTranslate />
          <RadioProvider phaseAllows={features.radio}>
            <FybyDayBanner />
            <SiteLogoBar features={features} showAdminLink={showAdminLink} />
            {children}
          </RadioProvider>
        </I18nProvider>
        {/* Investor demo: click through each release phase. Admin only. */}
        {admin && <PhaseSwitcher phase={phase} livePhase={live} previewing={phase !== live} />}
      </body>
    </html>
  );
}
