import Link from "next/link";
import { LICENSE_TIERS } from "@/lib/licensing";

export const metadata = { title: "License terms · Fyby" };

// Plain-language terms for the beat and sync licenses sold on Fyby
// (lib/licensing.ts). Agreed to by the buyer at checkout
// (app/license/[trackId]/page.tsx) and by the artist when they switch
// licensing on (app/dashboard/LicenseSettings.tsx).
export default function LicenseTermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 leading-relaxed">
      <h1 className="font-display text-3xl text-gold mb-2">Fyby license terms</h1>
      <p className="font-mono text-xs text-paper/50 mb-8">Version 1 · October 2026</p>

      <p className="mb-6 text-paper/80">
        These terms apply when you buy a license to use a song on Fyby. The artist who uploaded the song
        (&quot;the Artist&quot;) grants the license to the person or company named on your license certificate
        (&quot;you&quot;). Fyby runs the marketplace and processes payment; the Artist, not Fyby, is the licensor.
      </p>

      <h2 className="font-display text-xl mt-8 mb-3">Every license</h2>
      <ul className="list-disc pl-5 space-y-2 text-paper/80">
        <li>
          <strong>Non-exclusive.</strong> The Artist keeps all ownership of the song and may license it to others.
        </li>
        <li>
          <strong>Worldwide and permanent</strong> for the uses your license type allows, as long as you followed
          these terms.
        </li>
        <li>
          <strong>Personal to you.</strong> You can&apos;t transfer, resell, sublicense or share the license or the
          audio file.
        </li>
        <li>
          <strong>No standalone redistribution.</strong> You can&apos;t sell, stream or give away the song by itself,
          or use it as part of a sound library, sample pack or AI training set.
        </li>
        <li>
          <strong>Credit.</strong> Credit the Artist (&quot;Music: [song title] by [artist name]&quot;) wherever
          credits are practical, such as a video description or end credits.
        </li>
        <li>
          <strong>Content ID.</strong> If an automated claim appears on your content, show your license
          certificate; the Artist will help clear it.
        </li>
        <li>
          <strong>Not allowed:</strong> hateful, defamatory, unlawful or sexually explicit uses, political or
          campaign advertising, or anything implying the Artist endorses you, unless the Artist agrees in writing.
        </li>
        <li>
          <strong>Refunds.</strong> If a payment is refunded or charged back, the license ends.
        </li>
      </ul>

      <h2 className="font-display text-xl mt-8 mb-3">{LICENSE_TIERS.beat.label}</h2>
      <p className="text-paper/80 mb-2">{LICENSE_TIERS.beat.summary}</p>
      <ul className="list-disc pl-5 space-y-2 text-paper/80">
        <li>Covers one new song, released under your name, on streaming services, downloads and its music video.</li>
        <li>
          Credit the Artist as producer (&quot;Prod. by [artist name]&quot;). The Artist keeps their songwriting and
          publishing share in the new song&apos;s music, and keeps ownership of the instrumental itself.
        </li>
        <li>You can&apos;t register the instrumental itself with Content ID or claim ownership of it.</li>
      </ul>

      <h2 className="font-display text-xl mt-8 mb-3">{LICENSE_TIERS.standard.label}</h2>
      <p className="text-paper/80 mb-2">{LICENSE_TIERS.standard.summary}</p>
      <ul className="list-disc pl-5 space-y-2 text-paper/80">
        <li>Covers content you make and publish yourself, including monetized channels.</li>
        <li>Does not cover paid advertising, TV or broadcast, or theatrical release. Those need a Commercial license.</li>
      </ul>

      <h2 className="font-display text-xl mt-8 mb-3">{LICENSE_TIERS.commercial.label}</h2>
      <p className="text-paper/80 mb-2">{LICENSE_TIERS.commercial.summary}</p>
      <ul className="list-disc pl-5 space-y-2 text-paper/80">
        <li>Covers one brand, production or campaign, named on your license.</li>
        <li>For national TV campaigns or major studio films, contact the Artist through their Fyby page first.</li>
      </ul>

      <h2 className="font-display text-xl mt-8 mb-3">The Artist&apos;s promise</h2>
      <p className="text-paper/80">
        By offering a license, the Artist confirms they control the rights needed to grant it, including the
        recording and the composition, and that everyone credited on the song has agreed. Covers can&apos;t be
        licensed on Fyby.
      </p>

      <p className="text-paper/60 text-sm mt-10">
        Questions about a license? Contact the Artist from their Fyby page. These terms sit alongside Fyby&apos;s{" "}
        <Link href="/terms" className="text-gold underline">
          Terms of Service
        </Link>
        .
      </p>
    </main>
  );
}
