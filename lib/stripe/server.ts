import Stripe from "stripe";

// The Stripe client, constructed on first use rather than at import time.
//
// Constructing it eagerly (`new Stripe(process.env.STRIPE_SECRET_KEY!)` at
// module scope) meant every build needed a live secret key: `next build`
// imports each route to collect page data, the constructor threw
// "Neither apiKey nor config.authenticator provided" without one, and the
// build died on a page that never calls Stripe at all. That made deploys
// depend on secrets being present in an environment that does no Stripe
// work, which is how the Vercel preview build broke -- the key was scoped
// to Production only.
//
// Nothing calls Stripe during a build, so there's no reason to need the key
// then. A missing key still throws, just at the moment something actually
// tries to use Stripe, which is where the failure belongs and where the
// error message can say something useful.
let client: Stripe | null = null;

function getStripe(): Stripe {
  if (client) return client;

  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — this environment can't talk to Stripe. See .env.local.example."
    );
  }

  client = new Stripe(apiKey, {
    // Bumped from "2024-06-20" — that version predates the v2 Core Accounts
    // API (POST /v2/core/accounts) used in app/actions/stripe-connect.ts, and
    // no longer matches the type declarations shipped by the installed
    // "stripe" package (22.6.0), whose types only reflect this version.
    apiVersion: "2026-08-26.dahlia",
  });

  return client;
}

// A stand-in for the client so every call site keeps reading as
// `stripe.checkout.sessions.create(...)`. Each property access builds the
// real client (once) and forwards to it, so resources stay bound to their
// own client and nested access like `stripe.checkout.sessions` works
// unchanged.
export const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const target = getStripe();
    const value = Reflect.get(target, property);

    // Bind methods to the real client rather than letting `this` fall back
    // to this proxy. Resource objects (stripe.checkout, stripe.v2, ...) are
    // already bound to their own client internally, so they pass through
    // untouched and nested access keeps working.
    return typeof value === "function" ? value.bind(target) : value;
  },
});
