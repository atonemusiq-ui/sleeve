"use server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripe } from "@/lib/stripe/server";

// Same v2 Core Accounts "recipient" configuration as app/actions/stripe-
// connect.ts (artist payouts) — see that file's comments for why each field
// is set the way it is; this mirrors it exactly for a contributor's account.
const RECIPIENT_CONFIGURATION = {
  capabilities: {
    stripe_balance: {
      stripe_transfers: { requested: true },
    },
  },
} as const;

// A contributor has no Fyby login, so this whole flow is reached through a
// token in the URL (contributors.onboarding_token — see supabase/schema.sql)
// rather than an authenticated session; the token itself is the credential,
// looked up with the service-role client since there's no user session to
// scope an RLS-backed query to. Returns the hosted onboarding URL rather
// than redirecting itself — Next's redirect() throws a special error that
// has to propagate all the way up uncaught, so the caller (app/contributor-
// onboard/[token]/page.tsx) calls redirect() itself, outside any try/catch,
// once this has returned successfully.
export async function getContributorOnboardingUrl(token: string): Promise<string> {
  const supabase = createServiceRoleClient();

  const { data: contributor, error } = await supabase
    .from("contributors")
    .select("id, email, stripe_account_id")
    .eq("onboarding_token", token)
    .maybeSingle();

  if (error || !contributor) {
    throw new Error("This payout link isn't valid. Ask the artist for a fresh one.");
  }

  let accountId = contributor.stripe_account_id as string | null;

  if (!accountId) {
    const account = await stripe.v2.core.accounts.create({
      contact_email: contributor.email ?? undefined,
      dashboard: "express",
      // Same US-only limitation as the artist flow for now — see
      // app/actions/stripe-connect.ts's comment on identity.country.
      identity: { country: "US" },
      configuration: { recipient: RECIPIENT_CONFIGURATION },
      defaults: {
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
    });

    accountId = account.id;
    await supabase.from("contributors").update({ stripe_account_id: accountId }).eq("id", contributor.id);
  } else {
    // Re-apply on every visit, same reasoning as the artist flow: Account
    // Links v2 requires the link's configurations to exactly match what's
    // currently applied on the account, and this is a safe no-op if it's
    // already applied.
    await stripe.v2.core.accounts.update(accountId, {
      configuration: { recipient: RECIPIENT_CONFIGURATION },
    });
  }

  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient"],
  });
  const configurations = account.applied_configurations;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl || !siteUrl.startsWith("https://")) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set to an HTTPS URL to create a Stripe onboarding link."
    );
  }

  // Account Links expire in minutes, so this durable token-gated page is
  // both the refresh and return destination — a contributor who lands here
  // again (refresh, or coming back after finishing) just gets a fresh link
  // minted on the spot instead of a dead one.
  const accountLink = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations,
        refresh_url: `${siteUrl}/contributor-onboard/${token}`,
        return_url: `${siteUrl}/contributor-onboard/${token}/done`,
      },
    },
  });

  return accountLink.url;
}
