-- Sleeve Phase 1 schema
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query)

-- 1. profiles: one row per authenticated user, extends auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('artist', 'fan')),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- 2. artists: one row per artist account (role = 'artist' in profiles)
create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  bio text,
  created_at timestamptz not null default now()
);

-- 3. tracks: uploaded by artists, no audio file yet in Phase 1
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  title text not null,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now()
);

-- 4. purchases: stubbed for Phase 3, not used yet
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  fan_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'complete', 'refunded')),
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table artists enable row level security;
alter table tracks enable row level security;
alter table purchases enable row level security;

-- profiles: a user can read their own profile, and anyone can read display_name
-- (needed to show artist names on the public storefront)
create policy "profiles are publicly readable"
  on profiles for select
  using (true);

create policy "users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- artists: publicly readable (storefront needs artist names/bios),
-- but only the owning user can create/edit their artist row
create policy "artists are publicly readable"
  on artists for select
  using (true);

create policy "users can insert their own artist row"
  on artists for insert
  with check (auth.uid() = user_id);

create policy "users can update their own artist row"
  on artists for update
  using (auth.uid() = user_id);

-- tracks: publicly readable (storefront), but only the owning artist can write
create policy "tracks are publicly readable"
  on tracks for select
  using (true);

create policy "artists can insert their own tracks"
  on tracks for insert
  with check (
    artist_id in (select id from artists where user_id = auth.uid())
  );

create policy "artists can update their own tracks"
  on tracks for update
  using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

create policy "artists can delete their own tracks"
  on tracks for delete
  using (
    artist_id in (select id from artists where user_id = auth.uid())
  );

-- purchases: stub policies for Phase 3 (fans see their own purchases)
create policy "fans can read their own purchases"
  on purchases for select
  using (auth.uid() = fan_id);
