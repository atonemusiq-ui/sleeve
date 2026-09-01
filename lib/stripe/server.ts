import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Bumped from "2024-06-20" — that version predates the v2 Core Accounts
  // API (POST /v2/core/accounts) used in app/actions/stripe-connect.ts, and
  // no longer matches the type declarations shipped by the installed
  // "stripe" package (22.6.0), whose types only reflect this version.
  apiVersion: "2026-08-26.dahlia",
});
