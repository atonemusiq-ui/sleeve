# Sleeve — Phase 1

Real accounts + real database behind the Sleeve UI concept. No payments or file upload yet
(that's Phase 2–3).

## What's here

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase for Postgres, auth, and (later) storage
- Auth: sign up as Artist or Fan, log in, log out
- Artist dashboard: shows only the logged-in artist's own tracks, pulled from the DB
- Public storefront: lists all tracks from the DB with artist names (Buy button is disabled —
  wired up in Phase 3)

## Setup

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a free project, and wait for it to spin up.

### 2. Run the schema
In the Supabase dashboard: **SQL Editor → New query**, paste the contents of
`supabase/schema.sql`, and run it. This creates the `profiles`, `artists`, `tracks`, and
`purchases` tables along with Row Level Security policies (so artists can only edit their own
tracks, and everything else is publicly readable for the storefront).

### 3. Get your API keys
In the Supabase dashboard: **Settings → API**. You need the **Project URL** and the **anon
public key**.

### 4. Configure environment variables
```
cp .env.local.example .env.local
```
Paste your URL and anon key into `.env.local`.

### 5. Install and run
```
npm install
npm run dev
```
Visit `http://localhost:3000`.

### 6. Try it
- Go to `/signup`, create an Artist account.
- You'll land on `/dashboard` — empty catalog (upload comes in Phase 2).
- Go to `/` — the storefront (empty until tracks exist, which also needs Phase 2's upload flow).
- To sanity-check the DB wiring before Phase 2 exists, you can manually insert a test row into
  `tracks` via the Supabase Table Editor, using your artist's `id` from the `artists` table —
  it should immediately show up in both the dashboard and the storefront.

## Cost note

The Supabase free tier (500MB DB, 50k monthly active users) comfortably covers all of Phase 1.
The thing to watch is **Phase 2's storage** — audio file uploads count against a 1GB free
storage cap, which fills up fast with real tracks. Worth revisiting the plan tier once uploads
are live.

## Known gaps (by design, Phase 1 only)

- No file upload — `tracks` has no audio field yet
- Buy button is disabled — no payments wiring
- No password reset / email confirmation flow polish
- No artist bio editing UI yet (column exists, no form)
