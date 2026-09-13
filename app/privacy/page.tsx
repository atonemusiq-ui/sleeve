import Link from "next/link";

// Baseline Privacy Policy describing what Fyby actually collects and why,
// based on the real data flows in this codebase (Supabase auth/db, Stripe
// payments/Connect payouts, contributor royalty info, phone number
// collection at checkout). Starting draft, not a substitute for attorney
// review — see the message accompanying this page in chat.
export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-gold mb-2">Privacy Policy</h1>
      <p className="font-mono text-xs text-paper/40 mb-8">Last updated: {LAST_UPDATED}</p>

      <div className="font-body text-paper/80 leading-relaxed flex flex-col gap-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-paper [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        <p>
          This Privacy Policy explains what information Fyby (operated by Anthony Bryant Inc)
          collects, how we use it, and the choices you have. It applies to fyby-app.vercel.app
          and any successor domain.
        </p>

        <section>
          <h2>1. Information we collect</h2>
          <p>
            <span className="text-paper">Account information.</span> When you sign up, we collect
            your email, a display name, and (for Fans) whether you signed up to buy or to sell.
            Your password is handled by Supabase Auth and is never visible to us in plain text.
          </p>
          <p>
            <span className="text-paper">Checkout information.</span> When you buy a track or
            album, Stripe collects your billing details, phone number, and payment method
            directly — Fyby receives your email and phone number (to confirm your purchase and
            link it to an account) but never your full card number.
          </p>
          <p>
            <span className="text-paper">Artist information.</span> If you sign up as an Artist,
            we store your bio, photos, uploaded audio and cover art, genre tags, AI-disclosure
            answers, and — if you connect payouts — a Stripe-issued account identifier (not your
            bank details, which Stripe holds directly).
          </p>
          <p>
            <span className="text-paper">Contributor information.</span> If an Artist adds a
            co-writer or producer as a royalty contributor, we store the name, email, phone, and
            publishing information the Artist provides for that person, solely to track and pay
            out their royalty share.
          </p>
          <p>
            <span className="text-paper">Usage information.</span> We collect basic technical
            data (like device/browser info and pages visited) to keep the platform working and
            secure.
          </p>
        </section>

        <section>
          <h2>2. How we use information</h2>
          <ul>
            <li>To operate your account, process purchases, and pay out Artists and contributors;</li>
            <li>to send purchase confirmations, payout notifications, and account-related messages;</li>
            <li>to detect fraud, abuse, and violations of our Terms of Service;</li>
            <li>to calculate and, where enabled, collect applicable sales tax; and</li>
            <li>to improve Fyby&apos;s features and reliability.</li>
          </ul>
          <p>We don&apos;t sell your personal information to third parties.</p>
        </section>

        <section>
          <h2>3. Who we share information with</h2>
          <p>We share information only as needed to run Fyby:</p>
          <ul>
            <li>
              <span className="text-paper">Stripe</span> — payment processing, Artist/contributor
              payouts, and (where enabled) tax calculation and collection;
            </li>
            <li>
              <span className="text-paper">Supabase</span> — our database and authentication
              provider;
            </li>
            <li>
              <span className="text-paper">Vercel</span> — hosting for the Fyby application; and
            </li>
            <li>
              law enforcement or other parties, only when required by law or to protect Fyby,
              our users, or the public.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Cookies</h2>
          <p>
            Fyby uses essential cookies to keep you signed in and to remember basic preferences.
            We don&apos;t use third-party advertising trackers.
          </p>
        </section>

        <section>
          <h2>5. Data retention</h2>
          <p>
            We keep account and transaction records for as long as your account is active and as
            needed to satisfy tax, accounting, and legal obligations after that. Contributor
            royalty history is retained as a payment record even if a contributor is later
            removed from a track.
          </p>
        </section>

        <section>
          <h2>6. Your choices</h2>
          <p>
            You can update your profile information from your dashboard at any time. To request
            deletion of your account or personal information, contact us at {CONTACT_EMAIL} —
            we&apos;ll honor deletion requests except where we&apos;re required to retain records
            (for example, completed transaction and payout history for tax purposes).
          </p>
        </section>

        <section>
          <h2>7. Children&apos;s privacy</h2>
          <p>
            Fyby is not directed at children, and you must be at least 18 (or the age of majority
            in your jurisdiction) to use it. We don&apos;t knowingly collect information from
            anyone younger than that.
          </p>
        </section>

        <section>
          <h2>8. International use</h2>
          <p>
            Fyby can display and, where supported, charge in your local currency at checkout.
            Your information may be processed in the United States, where Fyby and its service
            providers operate.
          </p>
        </section>

        <section>
          <h2>9. Security</h2>
          <p>
            We rely on industry-standard providers (Stripe, Supabase) for sensitive data
            handling, and restrict access to personal information to what&apos;s needed to
            operate Fyby. No online service can guarantee perfect security, but we take
            reasonable steps to protect your information.
          </p>
        </section>

        <section>
          <h2>10. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Material changes will be posted here
            with a new &quot;Last updated&quot; date.
          </p>
        </section>

        <section>
          <h2>11. Contact</h2>
          <p>Questions about this policy? Reach us at {CONTACT_EMAIL}.</p>
        </section>

        <p className="font-mono text-xs text-paper/40 border-t border-paper/15 pt-6 mt-4">
          Related:{" "}
          <Link href="/terms" className="text-gold">
            Terms of Service
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
const CONTACT_EMAIL = "atonemusiq@gmail.com";
