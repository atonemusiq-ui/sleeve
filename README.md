# Fyby

Direct-to-fan music sales. Artists upload tracks and connect a bank account via Stripe
Connect; fans buy at a fixed price through Stripe Checkout; the artist gets paid directly
(the platform takes a 20% cut, hardcoded in `app/actions/checkout.ts`) instead of a
fraction of a cent per stream.

## What's here

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase for Postgres, auth, and storage
- Auth: sign up as Artist or Fan, log in, log out, reset a forgotten password. Artists
  confirm their email before first login (they handle real money via Connect); fans are
  auto-confirmed and signed in immediately on signup — no inbox round trip in the middle
  of buying something
- Artist dashboard: upload tracks (audio + optional cover art), edit a track's title,
  price, or cover art, or take it down entirely; see your own catalog with playback;
  write a bio (shown on your public artist page); connect a bank account via Stripe
  Connect (v2 Core Accounts, Express dashboard)
- Public storefront: search/filter across all published tracks, artist name links to a
  public artist profile page, Buy button starts a real Stripe Checkout session
- Buying requires an account (as of the fan-library change) — a fan who isn't logged in
  gets bounced to log in/sign up first, then back to buying, so every purchase is tied to
  a `fan_id`
- Post-purchase delivery: after a successful Checkout, `/success` verifies the payment
  with Stripe directly and hands back a signed stream/download link for the track — that
  page is bookmarkable, and the same track is also permanently available in...
- `/library` ("My Music"): every track a logged-in fan has bought, each with its own
  in-app player (signed URL, minted server-side, ownership checked via RLS on
  `purchases.fan_id`) — no downloading-and-figuring-out-playback required
- Two ways to back an artist beyond buying a track, both on the public artist page:
  **Super Fan** ($9/month subscription per artist) and a one-off **gift** of any amount
  with an optional message. Both take the same 20% platform cut as a sale and transfer the
  artist's share to their connected account — a gift on payment, a subscription on each
  paid invoice, logged to `subscription_payouts`
- Stripe webhook (`app/api/webhooks/stripe/route.ts`) records the purchase (including
  which fan bought it) and transfers the artist's cut to their connected account; guarded
  against duplicate delivery. Gifts ride the same destination; Super Fan subscription
  lifecycle has its own (`app/api/webhooks/stripe-subscriptions/route.ts`)
- Track audio lives in a **private** storage bucket — nobody can stream/download the full
  track without a signed URL minted after a verified purchase (or, for the artist, their
  own dashboard). Cover art lives in a separate public bucket.

## Setup

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a free project, and wait for it to spin up.

### 2. Run the schema
In the Supabase dashboard: **SQL Editor → New query**, paste the contents of
`supabase/schema.sql`, and run it. This creates the `profiles`, `artists`, `tracks`, and
`purchases` tables, their Row Level Security policies, the signup trigger that turns a new
`auth.users` row into a `profiles` (and, for artists, `artists`) row, and the two storage
buckets (`track-audio` private, `track-covers` public) with their access policies.

Every statement in that file is idempotent — safe to paste and re-run any time the schema
changes, on a brand-new project or this one.

### 3. Create a Stripe account (test mode is fine)
You need a secret key (**Developers → API keys**) and **three** webhook destinations
(**Developers → Webhooks**), each with its own signing secret — `.env.local.example` lists
which variable each one goes in:

| Endpoint | Events | Secret |
| --- | --- | --- |
| `/api/webhooks/stripe` | `checkout.session.completed` | `STRIPE_WEBHOOK_SECRET` |
| `/api/webhooks/stripe` | `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` | `STRIPE_WEBHOOK_SECRET_REFUNDS` |
| `/api/webhooks/stripe-subscriptions` | `customer.subscription.created`, `.updated`, `.deleted`, `invoice.payment_succeeded` | `STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS` |

The first two share a route, which tries both secrets in turn, so refunds and disputes can
live in their own Dashboard destination. `invoice.payment_succeeded` is what pays artists
their share of each month's subscription — without it subscribed, Super Fans are billed
and the artist never sees the money. Locally, run `stripe listen --forward-to
localhost:3000/<path>` per destination and use the secret each one prints.

Payouts use Stripe Connect (v2 Core Accounts) — no extra setup beyond a Stripe account;
each artist connects their own account from the dashboard.

### 4. Configure environment variables
```
cp .env.local.example .env.local
```
Fill in your Supabase URL/anon key/service role key and your Stripe secret key/webhook
secret. `NEXT_PUBLIC_SITE_URL` must be `https://` — Stripe's Account Links v2 rejects
`http://` return URLs even for localhost, so use an HTTPS tunnel (ngrok or similar) while
developing locally.

### 5. Install and run
```
npm install
npm run dev
```
Visit `http://localhost:3000` (or your tunnel URL, if you need real Stripe redirects to
reach you).

### 6. Try it
- Go to `/signup`, create an Artist account, confirm the email, log in.
- On `/dashboard`, connect a Stripe test bank account, then publish a track (any audio
  file + a price).
- Go to `/` — your track shows up on the storefront. Click Buy — since buying requires an
  account, you'll be bounced to log in/sign up (as a Fan, in a different browser/incognito
  window so you're not still logged in as the artist) and land back on the storefront.
  Click Buy again and pay with a
  [Stripe test card](https://docs.stripe.com/testing) (`4242 4242 4242 4242`, any future
  expiry/CVC).
- You land on `/success` with a working player and download link, and the track now shows
  up permanently on `/library` for that fan account. Check the Stripe dashboard: a
  transfer to the artist's connected account should show up alongside the original
  payment.

## Cost note

The Supabase free tier (500MB DB, 1GB storage, 50k monthly active users) covers this
comfortably for a small catalog. Audio files count against the storage cap — worth
revisiting the plan tier once real tracks (not test uploads) are live.

## Known gaps

- **The Super Fan perks aren't built.** Exclusive content, shoutouts, private show videos
  and the two-way video exchange are all planned, and nothing reads `artist_subscriptions`
  to gate any of them. The artist page and the Stripe checkout description both say so
  rather than promising them — Super Fan currently sells direct monthly support and
  nothing more. Update both when a perk ships.
- A subscription payout whose artist has no connected Stripe account (or whose transfer
  errored) is recorded in `subscription_payouts` as `unpaid`/`failed` rather than retried
  — that table is the list of what's owed, and settling it is manual for now
- Neither a refunded subscription invoice nor a refunded gift is clawed back
  automatically — the `charge.refunded` handler only looks at `purchases`. Both tables
  record their `stripe_transfer_id`, so a reversal can be done by hand in the Stripe
  dashboard.
- `artist_subscriptions.referred_by_fan_id` is logged from a `?ref=<fan_id>` link on the
  artist page, but no reward logic reads it
- The README's feature list above is behind the code — albums, the admin/moderation
  section, bookings, contributor payouts, notifications, videos, and embeds all shipped
  without being written up here
- Purchases made before the fan-library change (or by an anonymous/guest checkout, if one
  slips through) have no `fan_id` and won't show up in `/library` — only reachable via
  their original `/success` link
- No genre/tag metadata — storefront search only matches title and artist name
- Legacy rows from before audio was made private (`audio_url` set, `audio_path` null)
  still resolve to their old public URL — not retroactively secured. Re-upload to move a
  track onto the private path.
- Editing a track's cover art doesn't delete the old cover file from storage — orphaned,
  not a correctness problem, just some unused storage
- No bulk actions on the dashboard (re-order tracks, etc.)
