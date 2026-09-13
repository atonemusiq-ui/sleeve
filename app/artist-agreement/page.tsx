import Link from "next/link";

// Supplemental agreement specifically for Artists, on top of the general
// Terms of Service — covers the revenue split, payout mechanics, content
// warranties, and add-on features in more operational detail than the ToS.
// Starting draft, not a substitute for attorney review.
export default function ArtistAgreementPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-gold mb-2">Artist Agreement</h1>
      <p className="font-mono text-xs text-paper/40 mb-8">Last updated: {LAST_UPDATED}</p>

      <div className="font-body text-paper/80 leading-relaxed flex flex-col gap-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-paper [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        <p>
          This Artist Agreement supplements Fyby&apos;s{" "}
          <Link href="/terms" className="text-gold">
            Terms of Service
          </Link>{" "}
          and applies whenever you use Fyby&apos;s Artist features — uploading tracks or albums,
          adding contributors, connecting payouts, or using booking and add-on features. If
          anything here conflicts with the general Terms on an Artist-specific point, this
          Agreement controls.
        </p>

        <section>
          <h2>1. Revenue split</h2>
          <p>
            You keep 80% of every sale of your music on Fyby; Fyby retains a 20% platform fee.
            This is the same split for every Artist and every sale, and applies whether the buyer
            purchases a single track, a bundled album, or through an embedded buy widget on your
            own site.
          </p>
        </section>

        <section>
          <h2>2. Contributors and royalty splits</h2>
          <ul>
            <li>
              You can add contributors (co-writers, producers, or other collaborators) to a track
              and assign each one a percentage. Contributor percentages are calculated against
              your 80% share, not the total sale price, and cannot exceed 100% of your share in
              total.
            </li>
            <li>
              You&apos;re responsible for making sure contributor information (name, contact
              details, percentage) is accurate and that you actually owe them the split you enter
              — Fyby pays out based on what you tell us.
            </li>
            <li>
              A contributor can connect their own Stripe payout account via a link you send them,
              after which their share is paid automatically on future sales. Until they connect,
              their share accrues as an amount owed that you&apos;re responsible for paying them
              directly and marking as paid in your dashboard.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Payouts</h2>
          <p>
            Your 80% share is paid out via Stripe Connect once you complete Stripe&apos;s
            onboarding from your dashboard. Payout timing and any minimum thresholds follow
            Stripe&apos;s standard payout schedule for your account. If a sale is refunded or
            successfully disputed after you&apos;ve been paid, Fyby may reverse the corresponding
            payout, including recovering funds already transferred to you or your contributors.
          </p>
        </section>

        <section>
          <h2>4. Content ownership and license</h2>
          <p>
            You retain full ownership of everything you upload. By uploading, you grant Fyby a
            non-exclusive, worldwide license to host, stream previews of, and sell your music
            through the platform (including via the embeddable buy widget on third-party sites).
            You can remove a track from sale at any time; the license ends for future sales, but
            past sales and payout records remain valid.
          </p>
        </section>

        <section>
          <h2>5. Your warranties as an Artist</h2>
          <p>By uploading and listing music for sale, you confirm that:</p>
          <ul>
            <li>you own or have all necessary rights and licenses to sell the music;</li>
            <li>
              for cover recordings, you&apos;ve credited the original songwriter/producer as a
              contributor before the track goes on sale, and you&apos;re responsible for
              obtaining any mechanical license or paying any statutory royalty required by law for
              that cover — Fyby&apos;s credit step supports this obligation but doesn&apos;t
              replace it;
            </li>
            <li>
              any AI involvement in the track is disclosed accurately through Fyby&apos;s
              disclosure tools; and
            </li>
            <li>
              information submitted for &quot;Verified Human+AI&quot; certification is truthful —
              Fyby reviews what you submit, but the badge reflects that review, not an
              independent audit.
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Booking and add-on features</h2>
          <p>
            If you enable artist booking, fans can send you inquiries through your public artist
            page — responding to and fulfilling any booking is between you and the fan; Fyby
            isn&apos;t a party to it. Paid add-ons (like a bio video unlock) are one-time platform
            fees, separate from your 80/20 sale split, and non-refundable once unlocked except
            where required by law.
          </p>
        </section>

        <section>
          <h2>7. Taxes</h2>
          <p>
            You&apos;re an independent artist, not a Fyby employee or contractor, and you&apos;re
            responsible for reporting and paying any income tax on what you earn through Fyby.
            Separately, where Fyby has Stripe Tax enabled for a buyer&apos;s location, sales tax
            may be calculated and collected from the buyer on top of your listed price — that
            process is about buyer-side sales tax, not your own income tax obligations.
          </p>
        </section>

        <section>
          <h2>8. Removal and termination</h2>
          <p>
            We may remove a track or suspend your Artist account for violating this Agreement or
            the Terms of Service — for example, uploading content you don&apos;t have rights to,
            or misrepresenting AI involvement or contributor credits. Amounts already earned and
            verified before removal remain payable to you and your contributors.
          </p>
        </section>

        <section>
          <h2>9. Indemnification</h2>
          <p>
            You agree to cover Fyby&apos;s reasonable costs and damages if a third party makes a
            claim against Fyby arising from music you uploaded without the rights to sell it, or
            from inaccurate contributor or AI-disclosure information you provided.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>Questions about this Agreement? Reach us at {CONTACT_EMAIL}.</p>
        </section>

        <p className="font-mono text-xs text-paper/40 border-t border-paper/15 pt-6 mt-4">
          Related:{" "}
          <Link href="/terms" className="text-gold">
            Terms of Service
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="text-gold">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}

const LAST_UPDATED = "September 2026";
const CONTACT_EMAIL = "atonemusiq@gmail.com";
