// Where Stripe's hosted onboarding sends a contributor back to after they
// finish (see the return_url in app/actions/contributor-connect.ts). Stripe
// onboarding can also leave requirements outstanding — this page doesn't
// distinguish that from a fully-finished account, since checking would mean
// another Stripe round trip for a page whose only job is a friendly landing
// spot; the artist's dashboard is the place to notice a payout didn't go
// through and follow up.
export default function ContributorOnboardDonePage() {
  return (
    <main className="max-w-md mx-auto px-6 py-16 text-center">
      <h1 className="font-display text-2xl text-gold mb-4">You&apos;re all set</h1>
      <p className="font-mono text-sm text-paper/60">
        Your bank account is connected. Future sales that credit you will be paid out directly, no
        more waiting on the artist to send your share.
      </p>
    </main>
  );
}
