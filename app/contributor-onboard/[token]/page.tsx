import { redirect } from "next/navigation";
import { getContributorOnboardingUrl } from "@/app/actions/contributor-connect";

// Reached by a contributor clicking the link an artist copies for them from
// app/dashboard/ContributorManager.tsx — no login involved, the token in the
// URL is the whole credential. Mints a fresh Stripe onboarding link on every
// visit (see getContributorOnboardingUrl's comment on why) and sends them
// straight there.
export default async function ContributorOnboardPage({ params }: { params: { token: string } }) {
  let url: string;

  try {
    url = await getContributorOnboardingUrl(params.token);
  } catch (err: any) {
    // redirect() throws internally and must propagate uncaught, so this
    // try/catch only ever wraps the lookup/account-creation step above —
    // never the redirect call itself.
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-gold mb-4">Link not valid</h1>
        <p className="font-mono text-sm text-paper/60">{err.message}</p>
      </main>
    );
  }

  redirect(url);
}
