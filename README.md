# Sleeve

Direct-to-fan music sales. Artists upload tracks and connect a bank account via Stripe
Connect; fans buy at a fixed price through Stripe Checkout; the artist gets paid directly
(the platform takes a 20% cut, hardcoded in `app/actions/checkout.ts`) instead of a
fraction of a cent per stream.

## What's here

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase for Postgres, auth, and storage
- Auth: sign up as Artist or Fan, log in, log out (email confirmation required)
- Artist dashboard: upload tracks (audio + optional cover art), see your own catalog with
  playback, connect a bank account via Stripe Connect (v2 Core Accounts, Express dashboard)
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
- Stripe webhook (`app/api/webhooks/stripe/route.ts`) records the purchase (including
  which fan bought it) and transfers the artist's cut to their connected account; guarded
  against duplicate delivery
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
You need: a secret key (**Developers → API keys**), and a webhook signing secret for the
`checkout.session.completed` event pointed at `/api/webhooks/stripe` (**Developers →
Webhooks**, or run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` locally
and use the secret it prints). Payouts use Stripe Connect (v2 Core Accounts) — no extra
setup beyond a Stripe account; each artist connects their own account from the dashboard.

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

- No password reset flow
- No artist bio editing UI (column exists, no form)
- Purchases made before the fan-library change (or by an anonymous/guest checkout, if one
  slips through) have no `fan_id` and won't show up in `/library` — only reachable via
  their original `/success` link
- No track editing/deletion from the dashboard once published
- No genre/tag metadata — storefront search only matches title and artist name
- Legacy rows from before audio was made private (`audio_url` set, `audio_path` null)
  still resolve to their old public URL — not retroactively secured. Re-upload to move a
  track onto the private path.
- Email confirmation is required before first login, which adds a real speed bump to the
  "log in mid-checkout to buy" flow — worth revisiting if drop-off there turns out to be a
  problem.
