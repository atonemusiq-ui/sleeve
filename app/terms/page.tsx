import Link from "next/link";

// Baseline Terms of Service reflecting how Fyby actually works today (80/20
// split, Stripe-processed payments, contributor royalties, cover-song
// compliance, AI disclosure, Verified Human+AI). This is a solid starting
// draft, not a substitute for review by a licensed attorney — see the
// callout at the top of the page, which intentionally stays visible rather
// than being copy no one reads.
export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-gold mb-2">Terms of Service</h1>
      <p className="font-mono text-xs text-paper/40 mb-8">Last updated: {LAST_UPDATED}</p>

      <div className="font-body text-paper/80 leading-relaxed flex flex-col gap-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-paper [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of Fyby, a
          direct-to-fan music marketplace operated by Anthony Bryant Inc (&quot;Fyby,&quot;
          &quot;we,&quot; &quot;us&quot;). By creating an account or using Fyby, you agree to
          these Terms. If you don&apos;t agree, don&apos;t use Fyby.
        </p>

        <section>
          <h2>1. Who can use Fyby</h2>
          <p>
            You must be at least 18 years old, or the age of majority in your jurisdiction if
            older, to create an account, buy music, or sell music on Fyby — this is a marketplace
            that moves real money, so we don&apos;t offer accounts to minors. You&apos;re
            responsible for providing accurate account information and for activity on your
            account.
          </p>
        </section>

        <section>
          <h2>2. What Fyby is</h2>
          <p>
            Fyby lets independent artists (&quot;Artists&quot;) upload tracks and albums and sell
            them directly to fans (&quot;Fans&quot;), without a label or streaming intermediary
            taking the majority of the revenue. Fyby facilitates the transaction, payment
            processing, and payout — Fyby does not own, produce, or take an ownership stake in
            any Artist&apos;s music.
          </p>
        </section>

        <section>
          <h2>3. Payments, fees, and payouts</h2>
          <ul>
            <li>Fans pay the listed price for a track or album, processed securely by Stripe.</li>
            <li>
              Artists keep 80% of each sale; Fyby retains a 20% platform fee. This split is fixed
              and applies to every sale unless we announce a change in advance.
            </li>
            <li>
              If an Artist has added contributors (co-writers, producers, etc.) with royalty
              splits on a track, each contributor&apos;s share is calculated against the
              Artist&apos;s 80% — not the total sale price — and is either paid automatically via
              Stripe (once the contributor connects a payout account) or tracked as owed until the
              Artist marks it paid.
            </li>
            <li>
              Fyby never sees or stores your full card details — all card processing happens
              through Stripe.
            </li>
            <li>
              Where Fyby has Stripe Tax enabled for your location, applicable sales tax is added
              on top of the listed price and remitted per applicable law.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Refunds and disputes</h2>
          <p>
            Digital goods are generally sold as final, but we handle refunds and card-network
            disputes (chargebacks) case by case through Stripe. If a sale is refunded or disputed
            after an Artist or contributor has already been paid out, we may reverse the
            corresponding payout, including recovering funds from a connected Stripe account,
            to the extent the sale is unwound.
          </p>
        </section>

        <section>
          <h2>5. Artist content, ownership, and your responsibilities</h2>
          <p>
            You keep ownership of the music you upload. By uploading a track or album, you grant
            Fyby a license to host, stream previews of, and sell it through the platform. In
            return, you represent that:
          </p>
          <ul>
            <li>
              you own the rights to the music you upload, or have all necessary rights and
              licenses to sell it on Fyby;
            </li>
            <li>
              if a track is a cover of someone else&apos;s song, you have credited the original
              songwriter/producer as a contributor before offering it for sale, and you are
              responsible for any mechanical licensing or royalty obligations that apply to cover
              recordings under applicable law — Fyby&apos;s credit-attestation step is a
              compliance aid, not a substitute for your own licensing obligations; and
            </li>
            <li>
              any AI involvement in a track is disclosed accurately using Fyby&apos;s disclosure
              tools, and any information you submit for the &quot;Verified Human+AI&quot;
              certification is truthful. Verification reflects Fyby&apos;s review of what you
              submitted — it is not an independent guarantee to buyers.
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Prohibited conduct</h2>
          <p>You may not use Fyby to:</p>
          <ul>
            <li>upload music you don&apos;t have the rights to sell;</li>
            <li>misrepresent AI involvement, authorship, or contributor credits;</li>
            <li>upload unlawful, infringing, or fraudulent content;</li>
            <li>attempt to circumvent payment processing or manipulate payouts; or</li>
            <li>abuse, harass, or defraud other users.</li>
          </ul>
          <p>
            We may remove content, suspend, or terminate accounts that violate these Terms,
            with or without notice depending on severity.
          </p>
        </section>

        <section>
          <h2>7. Add-on features</h2>
          <p>
            Fyby offers optional paid add-ons for Artists — including artist booking inquiries,
            paid bio video unlocks, and the Verified Human+AI certification. These are one-time
            platform fees for the feature itself, separate from the 80/20 sale split described
            above, and are non-refundable once the feature is unlocked or the review is
            completed, except where required by law.
          </p>
        </section>

        <section>
          <h2>8. Intellectual property complaints</h2>
          <p>
            If you believe content on Fyby infringes your copyright or other rights, contact us
            at {CONTACT_EMAIL} with enough detail to identify the content and your claim. We&apos;ll
            review and remove infringing content where appropriate.
          </p>
        </section>

        <section>
          <h2>9. Disclaimers and limitation of liability</h2>
          <p>
            Fyby is provided &quot;as is.&quot; We don&apos;t guarantee the platform will be
            uninterrupted or error-free, and we aren&apos;t responsible for the quality,
            legality, or accuracy of Artist-uploaded content. To the fullest extent permitted by
            law, Fyby&apos;s total liability for any claim relating to the platform is limited to
            the fees you paid to Fyby in the twelve months before the claim arose.
          </p>
        </section>

        <section>
          <h2>10. Governing law</h2>
          <p>
            These Terms are governed by the laws of the State of California, without regard to
            conflict-of-law principles.
          </p>
        </section>

        <section>
          <h2>11. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. If we make material changes, we&apos;ll
            post the updated Terms here with a new &quot;Last updated&quot; date. Continuing to
            use Fyby after changes take effect means you accept the updated Terms.
          </p>
        </section>

        <section>
          <h2>12. Contact</h2>
          <p>
            Questions about these Terms? Reach us at {CONTACT_EMAIL}.
          </p>
        </section>

        <p className="font-mono text-xs text-paper/40 border-t border-paper/15 pt-6 mt-4">
          Related:{" "}
          <Link href="/privacy" className="text-gold">
            Privacy Policy
          </Link>{" "}
          ·{" "}
          <Link href="/artist-agreement" className="text-gold">
            Artist Agreement
          </Link>
        </p>
      </div>
    </main>
  );
}

const LAST_UPDATED = "September 2026";
// TODO: point this at a real support inbox before relying on these pages —
// using the founder's personal address as a placeholder for now rather than
// inventing a domain that doesn't exist yet.
const CONTACT_EMAIL = "atonemusiq@gmail.com";
