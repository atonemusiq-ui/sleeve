-- Fyby schema
--
-- Safe to re-run: every statement is idempotent (create-if-not-exists /
-- add-column-if-not-exists / drop-then-create for policies), so this same
-- file works both for a brand-new Supabase project and for picking up
-- changes on the existing live project.
--
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- ============================================================================
-- 1. profiles: one row per authenticated user, extends auth.users
-- ============================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('artist', 'fan')),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. artists: one row per artist account (role = 'artist' in profiles)
-- ============================================================================
create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  bio text,
  created_at timestamptz not null default now()
);

-- Stripe Connect account id for payouts (added in the Stripe Connect phase).
alter table artists add column if not exists stripe_account_id text;

-- ============================================================================
-- 3. tracks
-- ============================================================================
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  title text not null,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now()
);

-- cover_url: full public URL in the public "track-covers" bucket — fine to
-- expose directly, it's artwork, not the paid content.
alter table tracks add column if not exists cover_url text;

-- audio_path: a *storage path* (not a URL) inside the private "track-audio"
-- bucket, e.g. "<artist_id>/171234-song.mp3". Deliberately not a public URL —
-- the whole point is that nobody can stream/download the paid track without
-- a signed URL minted after a verified purchase. See app/success/page.tsx
-- and app/dashboard/page.tsx for where signed URLs get generated.
alter table tracks add column if not exists audio_path text;

-- Legacy column from before audio was made private. Some early rows may
-- still have a direct (public) audio_url here instead of audio_path — the
-- app falls back to it when audio_path is null. Do not use this for new
-- uploads.
alter table tracks add column if not exists audio_url text;
-- preview_url: full public URL in the public track-previews bucket. Unlike
-- audio_path, this is meant to be freely playable by anyone, no signed URL,
-- no purchase required. A 15-second clip trimmed client-side at upload time
-- (see app/dashboard/UploadForm.tsx). Nullable, older tracks uploaded before
-- this feature will not have one.
alter table tracks add column if not exists preview_url text;

-- ============================================================================
-- 4. purchases: one row per completed Stripe checkout
-- ============================================================================
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  fan_id uuid references profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'complete', 'refunded')),
  created_at timestamptz not null default now()
);

-- Checkout is anonymous (no login required to buy), so a purchase is not
-- always tied to a Fyby account.
alter table purchases alter column fan_id drop not null;

-- Buyer contact + payment-split bookkeeping, written by the Stripe webhook.
alter table purchases add column if not exists buyer_email text;
alter table purchases add column if not exists buyer_phone text;
alter table purchases add column if not exists amount_cents integer;
alter table purchases add column if not exists platform_fee_cents integer;
alter table purchases add column if not exists artist_payout_cents integer;
alter table purchases add column if not exists stripe_payment_intent_id text;

-- Stripe can redeliver the same webhook event more than once. This unique
-- index (partial, so multiple NULLs are fine) lets the webhook handler
-- detect "already processed this payment" and skip re-inserting the
-- purchase / re-transferring the artist's payout.
create unique index if not exists purchases_stripe_payment_intent_id_key
  on purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table profiles enable row level security;
alter table artists enable row level security;
alter table tracks enable row level security;
alter table purchases enable row level security;

-- profiles: a user can read their own profile, and anyone can read display_name
-- (needed to show artist names on the public storefront)
drop policy if exists "profiles are publicly readable" on profiles;
create policy "profiles are publicly readable"
  on profiles for select
  using (true);

drop policy if exists "users can insert their own profile" on profiles;
create policy "users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on profiles;
create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- artists: publicly readable (storefront + artist pages need names/bios),
-- but only the owning user can create/edit their artist row
drop policy if exists "artists are publicly readable" on artists;
create policy "artists are publicly readable"
  on artists for select
  using (true);

drop policy if exists "users can insert their own artist row" on artists;
create policy "users can insert their own artist row"
  on artists for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update their own artist row" on artists;
create policy "users can update their own artist row"
  on artists for update
  using (auth.uid() = user_id);

-- tracks: publicly readable (storefront), but only the owning artist can write
drop policy if exists "tracks are publicly readable" on tracks;
create policy "tracks are publicly readable"
  on tracks for select
  using (true);

drop policy if exists "artists can insert their own tracks" on tracks;
create policy "artists can insert their own tracks"
  on tracks for insert
  with check (
    artist_id in (select id from artists where user_id = auth.uid())
  );

drop policy if exists "artists can update their own tracks" on tracks;
create policy "artists can update their own tracks"
  on tracks for update
  using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

drop policy if exists "artists can delete their own tracks" on tracks;
create policy "artists can delete their own tracks"
  on tracks for delete
  using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

-- purchases: fans can read their own purchases (only meaningful when a fan
-- was logged in at checkout — anonymous purchases are looked up via the
-- Stripe checkout session instead, see app/success/page.tsx)
drop policy if exists "fans can read their own purchases" on purchases;
create policy "fans can read their own purchases"
  on purchases for select
  using (auth.uid() = fan_id);

-- ============================================================================
-- Signup trigger: creates the matching profiles (and, for artists, artists)
-- row as soon as someone confirms/creates an auth.users row. app/actions/
-- auth.ts passes `role` and `display_name` in signUp()'s options.data, which
-- Supabase stores on auth.users.raw_user_meta_data — this trigger reads it
-- from there.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'fan'),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  if coalesce(new.raw_user_meta_data->>'role', 'fan') = 'artist' then
    insert into public.artists (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Storage: two buckets —
--   track-audio  (private) the actual paid audio file. No public policy;
--                access only via signed URLs minted server-side after a
--                verified purchase, or for the owning artist.
--   track-covers (public)  cover art. Fine to serve directly.
-- Both use a "<artist_id>/..." path convention, enforced by the insert
-- policies below.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('track-audio', 'track-audio', false)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('track-covers', 'track-covers', true)
on conflict (id) do update set public = excluded.public;

-- track-previews (public) the 15-second preview clip trimmed client-side at
-- upload (see lib/generatePreviewClip.ts / app/dashboard/UploadForm.tsx).
-- Freely playable, same "<artist_id>/..." path convention as covers.
insert into storage.buckets (id, name, public)
values ('track-previews', 'track-previews', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "artists upload their own audio" on storage.objects;
create policy "artists upload their own audio"
  on storage.objects for insert
  with check (
    bucket_id = 'track-audio'
    and (storage.foldername(name))[1] in (select id::text from artists where user_id = auth.uid())
  );

drop policy if exists "artists read their own audio" on storage.objects;
create policy "artists read their own audio"
  on storage.objects for select
  using (
    bucket_id = 'track-audio'
    and (storage.foldername(name))[1] in (select id::text from artists where user_id = auth.uid())
  );

drop policy if exists "artists upload their own covers" on storage.objects;
create policy "artists upload their own covers"
  on storage.objects for insert
  with check (
    bucket_id = 'track-covers'
    and (storage.foldername(name))[1] in (select id::text from artists where user_id = auth.uid())
  );

drop policy if exists "covers are publicly readable" on storage.objects;
create policy "covers are publicly readable"
  on storage.objects for select
  using (bucket_id = 'track-covers');

drop policy if exists "artists upload their own previews" on storage.objects;
create policy "artists upload their own previews"
  on storage.objects for insert
  with check (
    bucket_id = 'track-previews'
    and (storage.foldername(name))[1] in (select id::text from artists where user_id = auth.uid())
  );

drop policy if exists "previews are publicly readable" on storage.objects;
create policy "previews are publicly readable"
  on storage.objects for select
  using (bucket_id = 'track-previews');

-- Lets an artist take a track down (app/dashboard/TrackList.tsx) and have
-- its audio file actually removed from storage, not just orphaned.
drop policy if exists "artists delete their own audio" on storage.objects;
create policy "artists delete their own audio"
  on storage.objects for delete
  using (
    bucket_id = 'track-audio'
    and (storage.foldername(name))[1] in (select id::text from artists where user_id = auth.uid())
  );

drop policy if exists "artists delete their own covers" on storage.objects;
create policy "artists delete their own covers"
  on storage.objects for delete
  using (
    bucket_id = 'track-covers'
    and (storage.foldername(name))[1] in (select id::text from artists where user_id = auth.uid())
  );

drop policy if exists "artists delete their own previews" on storage.objects;
create policy "artists delete their own previews"
  on storage.objects for delete
  using (
    bucket_id = 'track-previews'
    and (storage.foldername(name))[1] in (select id::text from artists where user_id = auth.uid())
  );
-- ============================================================================
-- Contributors: per-track collaborators with a royalty split, and the
-- payout ledger tracking what's owed to each of them per sale.
-- ============================================================================
create table if not exists contributors (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table contributors add column if not exists name text not null;
alter table contributors add column if not exists email text;
alter table contributors add column if not exists phone text;
alter table contributors add column if not exists publishing_info text;
alter table contributors add column if not exists percentage numeric not null;

alter table contributors enable row level security;

drop policy if exists "artists manage contributors on their own tracks" on contributors;
create policy "artists manage contributors on their own tracks"
  on contributors for all
  using (
    track_id in (
      select t.id from tracks t
      join artists a on a.id = t.artist_id
      where a.user_id = auth.uid()
    )
  )
  with check (
    track_id in (
      select t.id from tracks t
      join artists a on a.id = t.artist_id
      where a.user_id = auth.uid()
    )
  );

-- Defense-in-depth: app/actions/contributors.ts checks the 100% cap before
-- writing (that's what gives the artist a clean inline error), but enforce
-- it here too so it can never be violated even if that check is bypassed.
create or replace function public.check_contributor_percentage_total()
returns trigger
language plpgsql
as $$
declare
  total numeric;
begin
  select coalesce(sum(percentage), 0) into total
  from contributors
  where track_id = new.track_id
    and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if total + new.percentage > 100 then
    raise exception 'Contributor percentages for this track would exceed 100%% (existing %, plus new %)', total, new.percentage;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_contributor_percentage_total on contributors;
create trigger enforce_contributor_percentage_total
  before insert or update on contributors
  for each row execute function public.check_contributor_percentage_total();

create table if not exists contributor_payouts (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references contributors(id) on delete cascade,
  purchase_id uuid references purchases(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table contributor_payouts add column if not exists amount_owed_cents integer;
alter table contributor_payouts add column if not exists status text not null default 'owed' check (status in ('owed', 'paid'));
alter table contributor_payouts add column if not exists paid_at timestamptz;

alter table contributor_payouts enable row level security;

drop policy if exists "artists read payouts for their own contributors" on contributor_payouts;
create policy "artists read payouts for their own contributors"
  on contributor_payouts for select
  using (
    contributor_id in (
      select c.id from contributors c
      join tracks t on t.id = c.track_id
      join artists a on a.id = t.artist_id
      where a.user_id = auth.uid()
    )
  );

drop policy if exists "artists update payouts for their own contributors" on contributor_payouts;
create policy "artists update payouts for their own contributors"
  on contributor_payouts for update
  using (
    contributor_id in (
      select c.id from contributors c
      join tracks t on t.id = c.track_id
      join artists a on a.id = t.artist_id
      where a.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Albums: artist-curated bundles of existing tracks sold at a flat price.
-- ============================================================================
create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  title text not null,
  cover_url text,
  price_cents integer not null,
  created_at timestamptz not null default now()
);

create table if not exists album_tracks (
  album_id uuid not null references albums(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  track_order integer not null,
  primary key (album_id, track_id)
);

alter table purchases add column if not exists album_id uuid references albums(id);

alter table albums enable row level security;
alter table album_tracks enable row level security;

drop policy if exists "albums are publicly readable" on albums;
create policy "albums are publicly readable"
  on albums for select
  using (true);

drop policy if exists "artists manage their own albums" on albums;
create policy "artists manage their own albums"
  on albums for all
  using (artist_id in (select id from artists where user_id = auth.uid()))
  with check (artist_id in (select id from artists where user_id = auth.uid()));

drop policy if exists "album_tracks are publicly readable" on album_tracks;
create policy "album_tracks are publicly readable"
  on album_tracks for select
  using (true);

drop policy if exists "artists manage their own album_tracks" on album_tracks;
create policy "artists manage their own album_tracks"
  on album_tracks for all
  using (
    album_id in (
      select a.id from albums a
      join artists ar on ar.id = a.artist_id
      where ar.user_id = auth.uid()
    )
  )
  with check (
    album_id in (
      select a.id from albums a
      join artists ar on ar.id = a.artist_id
      where ar.user_id = auth.uid()
    )
  );

-- A single Stripe payment can now cover multiple tracks (an album), so the
-- old "one row per payment_intent, period" unique index has to become
-- "one row per (payment_intent, track)" — still blocks a true duplicate
-- webhook redelivery from double-inserting the same track's purchase row,
-- but no longer blocks the 2nd/3rd/... track of a legitimate album sale
-- that shares one payment_intent_id.
drop index if exists purchases_stripe_payment_intent_id_key;
create unique index if not exists purchases_stripe_payment_intent_track_key
  on purchases (stripe_payment_intent_id, track_id)
  where stripe_payment_intent_id is not null;


-- ============================================================================
-- Genre browsing + free-text tag + per-track AI disclosure (all optional).
-- Validity of `genre` against the fixed list (lib/genres.ts) is enforced at
-- the application layer (app/actions/upload.ts, app/actions/tracks.ts) —
-- same pattern as track pricing — rather than a DB check constraint, so the
-- genre list can grow without a migration.
-- ============================================================================
alter table tracks add column if not exists genre text;
alter table tracks add column if not exists custom_tag text;
alter table tracks add column if not exists ai_disclosure boolean not null default false;

-- ============================================================================
-- Booking requests: fans can inquire about booking an artist directly from
-- the artist's public page (app/artists/[id]/BookingForm.tsx) — no account
-- required to submit one, which is why the insert policy below is
-- intentionally public. Only the owning artist can ever read, update
-- (change status), or delete the requests they receive.
-- ============================================================================
create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  fan_name text not null,
  fan_email text not null,
  fan_phone text,
  event_date date,
  event_location text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'declined')),
  created_at timestamptz not null default now()
);

alter table booking_requests enable row level security;

drop policy if exists "anyone can submit a booking request" on booking_requests;
create policy "anyone can submit a booking request"
  on booking_requests for insert
  with check (true);

drop policy if exists "artists manage their own booking requests" on booking_requests;
create policy "artists manage their own booking requests"
  on booking_requests for all
  using (artist_id in (select id from artists where user_id = auth.uid()))
  with check (artist_id in (select id from artists where user_id = auth.uid()));
