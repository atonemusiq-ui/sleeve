import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sleeve",
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
      <body className="bg-ink text-paper font-body min-h-screen">{children}</body>
    </html>
  );
}
