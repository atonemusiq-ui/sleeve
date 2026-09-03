"use server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { redirect } from "next/navigation";

// The v2 Core Accounts "recipient" configuration that reproduces the old
// `capabilities.transfers` behavior of a `type: "express"` account. This is
// used both when creating a new account and when re-applying the
// configuration on an existing one, so account creation and account link
// creation always agree on which configurations are active.
//
// Note: there's no settable `applied` field here. That field exists only
// under the "configuration deactivation" preview feature (Stripe-Version
// 2025-08-27.preview and later previews) — the account's actual API version
// ("2026-08-26.dahlia", a GA release) doesn't recognize it and rejects it
// with "Unknown field". On GA, whether a configuration is applied is
// reported back as a top-level, read-only `applied_configurations: string[]`
// array on the Account object — it isn't set directly. Simply including
// `recipient` here (with its capabilities) is what applies it, on both
// create and update.
const RECIPIENT_CONFIGURATION = {
  capabilities: {
    stripe_balance: {
      stripe_transfers: { requested: true },
    },
  },
} as const;

export async function connectStripeAccount() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const { data: artist, error } = await supabase
    .from("artists")
    .select("id, stripe_account_id")
    .eq("user_id", user.id)
    .single();

  if (error || !artist) {
    throw new Error("Could not find your artist profile.");
  }

  let accountId = artist.stripe_account_id;

  if (!accountId) {
    // Stripe now creates connected accounts through the v2 Core Accounts API
    // (POST /v2/core/accounts) instead of the legacy `stripe.accounts.create`
    // call with `type: "express"`. To reproduce the old Express account:
    //  - `dashboard: "express"` grants the same Express Dashboard access
    //    `type: "express"` used to.
    //  - the "recipient" configuration's `stripe_balance.stripe_transfers`
    //    capability is the v2 equivalent of the old `capabilities.transfers`.
    // Everything else (KYC, requirements, hosted onboarding) is still
    // collected the same way, via the Account Link created below.
    const account = await stripe.v2.core.accounts.create({
      contact_email: user.email,
      dashboard: "express",
      // Stripe now requires `identity.country` to be set on the account
      // before any configuration (including "recipient") can be applied —
      // creating an account with a configuration but no identity.country
      // fails with "identity_country_required". This app doesn't currently
      // collect the artist's country anywhere, so this is hardcoded to the
      // US for now. If you start onboarding artists outside the US, this
      // needs to come from user input instead.
      identity: {
        country: "US",
      },
      configuration: {
        recipient: RECIPIENT_CONFIGURATION,
      },
      defaults: {
        responsibilities: {
          // Matches classic Express behavior: your platform (not Stripe)
          // collects fees and is liable for negative balances. If your
          // previous Express accounts used the "recipient" service
          // agreement (Stripe liable), set both of these to "stripe"
          // instead.
          fees_collector: "application",
          losses_collector: "application",
        },
      },
    });

    accountId = account.id;

    await supabase
      .from("artists")
      .update({ stripe_account_id: accountId })
      .eq("id", artist.id);
  } else {
    // This artist already has a stored account ID — possibly from before
    // this file used the v2 Accounts API (e.g. a legacy Express account),
    // or from an account created without the "recipient" configuration
    // applied. Account Links v2 requires the account_link's `configurations`
    // to exactly match the account's currently applied configurations
    // (error: "configs_must_match_to_use_account_links"), so re-apply the
    // same configuration here before generating the link. This is a no-op
    // (and safe to call repeatedly) if it's already applied.
    await stripe.v2.core.accounts.update(accountId, {
      configuration: {
        recipient: RECIPIENT_CONFIGURATION,
      },
    });
  }

  // Account Links v2 requires the link's `configurations` list to match the
  // account's `applied_configurations` *exactly*. It's tempting to hardcode
  // `["recipient"]` here since that's the only configuration this file ever
  // requests — but `dashboard: "express"` causes Stripe to also apply a bare
  // `merchant` configuration alongside it (no capabilities requested on it,
  // it just comes along for the ride with the Express dashboard), so the
  // account ends up with `applied_configurations: ["recipient", "merchant"]`
  // even though this file never asked for "merchant" directly. Sending only
  // `["recipient"]` to account_links against an account like that fails with
  // "configs_must_match_to_use_account_links". So: fetch what's actually
  // applied right before creating the link, and use that list verbatim
  // instead of assuming it's just "recipient".
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient"],
  });
  const configurations = account.applied_configurations;

  // Stripe requires HTTPS for `return_url`/`refresh_url` on Account Links v2
  // — including for local testing against localhost — and fails account
  // link creation outright if either URL is HTTP. The previous
  // `http://localhost:3000` fallback here was always going to be rejected
  // once you actually reached this call, so it's removed: set
  // NEXT_PUBLIC_SITE_URL to an HTTPS URL (e.g. an ngrok/tunnel URL while
  // developing locally) rather than relying on a fallback.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl || !siteUrl.startsWith("https://")) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set to an HTTPS URL to create a Stripe onboarding link (Account Links v2 rejects http:// return/refresh URLs, even for localhost)."
    );
  }

  // Account Links v2 replaces `stripe.accountLinks.create` for accounts
  // created via the v2 Accounts API. It still returns a single-use hosted
  // onboarding URL, and the redirect below is unchanged. `configurations`
  // is the account's actual applied list fetched above, not a hardcoded
  // guess — see the comment there for why that distinction matters.
  const accountLink = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations,
        refresh_url: `${siteUrl}/dashboard`,
        return_url: `${siteUrl}/dashboard`,
      },
    },
  });

  redirect(accountLink.url);
}
