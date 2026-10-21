-- ============================================================================
-- Fyby Vendors: merchants selling products and services (photography,
-- catering, DJs, clothing, gear...) alongside the music. A vendor signs up
-- with role 'vendor', pays the Vendor Pro plan (lib/plans.ts VENDOR_PLAN) to
-- go live, and lists products with photos in the /vendor portal. Buyers
-- check out through Fyby; the vendor is paid through Stripe Connect minus
-- Fyby's cut, and the buyer pays shipping and any sales tax on top.
-- Writes go through server actions (ownership checked there, service-role
-- client), so tables only need read policies here.
-- ============================================================================

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('artist', 'fan', 'vendor'));

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  business_name text not null default '',
  tagline text,
  bio text,
  logo_url text,
  website_url text,
  city text,
  categories text[] not null default '{}',
  stripe_account_id text,
  -- inactive until the Vendor Pro subscription is paid; only 'active'
  -- vendors show publicly (Vendors page, advertiser links, storefront).
  plan_status text not null default 'inactive' check (plan_status in ('inactive', 'active', 'past_due', 'canceled')),
  plan_subscription_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists vendor_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'product' check (kind in ('product', 'service')),
  price_cents integer not null check (price_cents >= 100),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  image_urls text[] not null default '{}',
  active boolean not null default true,
  frozen boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists vendor_products_vendor_idx on vendor_products (vendor_id);

create table if not exists vendor_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references vendor_products(id) on delete set null,
  vendor_id uuid not null references vendors(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete set null,
  buyer_email text,
  buyer_phone text,
  product_title text not null,
  kind text not null default 'product',
  quantity integer not null default 1,
  unit_price_cents integer not null,
  shipping_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null,
  platform_fee_cents integer not null,
  vendor_payout_cents integer not null,
  shipping_address jsonb,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  status text not null default 'paid' check (status in ('paid', 'fulfilled', 'refunded')),
  created_at timestamptz not null default now()
);
create index if not exists vendor_orders_vendor_idx on vendor_orders (vendor_id);

alter table vendors enable row level security;
alter table vendor_products enable row level security;
alter table vendor_orders enable row level security;

drop policy if exists "anyone can view live vendors" on vendors;
create policy "anyone can view live vendors" on vendors for select
  using ((plan_status = 'active' and is_active) or user_id = auth.uid());

drop policy if exists "anyone can view live vendor products" on vendor_products;
create policy "anyone can view live vendor products" on vendor_products for select
  using (
    vendor_id in (select id from vendors where user_id = auth.uid())
    or (active and not frozen and vendor_id in (select id from vendors where plan_status = 'active' and is_active))
  );

drop policy if exists "vendors and buyers see their orders" on vendor_orders;
create policy "vendors and buyers see their orders" on vendor_orders for select
  using (buyer_id = auth.uid() or vendor_id in (select id from vendors where user_id = auth.uid()));

-- Product photos: public bucket, "<vendor_id>/..." paths, uploaded straight
-- from the vendor's browser like track covers.
insert into storage.buckets (id, name, public)
values ('vendor-images', 'vendor-images', true)
on conflict (id) do nothing;

drop policy if exists "vendors upload their own images" on storage.objects;
create policy "vendors upload their own images" on storage.objects for insert
  with check (
    bucket_id = 'vendor-images'
    and (storage.foldername(name))[1] in (select id::text from vendors where user_id = auth.uid())
  );
drop policy if exists "vendors delete their own images" on storage.objects;
create policy "vendors delete their own images" on storage.objects for delete
  using (
    bucket_id = 'vendor-images'
    and (storage.foldername(name))[1] in (select id::text from vendors where user_id = auth.uid())
  );

-- New accounts: vendors get their vendors row automatically, same as artists.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'fan'),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  if coalesce(new.raw_user_meta_data->>'role', 'fan') = 'artist' then
    insert into public.artists (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;

  if coalesce(new.raw_user_meta_data->>'role', 'fan') = 'vendor' then
    insert into public.vendors (user_id, business_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;
