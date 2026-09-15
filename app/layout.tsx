import type { Metadata } from "next";
import "./globals.css";
import GlobalAudioManager from "./GlobalAudioManager";

export const metadata: Metadata = {
  title: "Fyby",
  description: "Direct-to-fan music sales. Artists keep the large majority of every sale.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink text-paper font-body min-h-screen">
        {/* Enforces "only one song plays at a time" across the whole site —
            see GlobalAudioManager.tsx for how. Renders nothing itself. */}
        <GlobalAudioManager />
        {children}
      </body>
    </html>
  );
}
