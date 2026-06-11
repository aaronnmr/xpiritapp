create type public.billing_provider as enum ('revenuecat', 'apple_app_store', 'google_play', 'manual');
create type public.subscription_status as enum ('free', 'trialing', 'active', 'grace_period', 'paused', 'expired', 'cancelled', 'refunded');
create type public.entitlement_status as enum ('active', 'inactive');
create type public.purchase_platform as enum ('ios', 'android', 'web', 'unknown');

alter table public.profiles
  add column if not exists revenuecat_app_user_id text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists biometric_sync_enabled boolean not null default false,
  add column if not exists manual_logging_enabled boolean not null default true,
  add column if not exists apple_sign_in_enabled boolean not null default false,
  add column if not exists google_sign_in_enabled boolean not null default true;

create table public.subscription_products (
  id text primary key,
  provider public.billing_provider not null default 'revenuecat',
  entitlement_id text not null,
  display_name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR',
  billing_period text not null default 'monthly',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_products (id, entitlement_id, display_name, price_cents, currency, billing_period, metadata)
values
  ('xpirit_premium_monthly_299', 'premium_reports', 'Xpirit Premium', 299, 'EUR', 'monthly', '{"reports": true, "analytics": "basic"}'),
  ('xpirit_elite_monthly_799', 'elite_analytics', 'Xpirit Elite', 799, 'EUR', 'monthly', '{"reports": true, "analytics": "advanced"}')
on conflict (id) do update set
  entitlement_id = excluded.entitlement_id,
  display_name = excluded.display_name,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  billing_period = excluded.billing_period,
  metadata = excluded.metadata,
  updated_at = now();

create table public.revenuecat_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  app_user_id text not null unique,
  original_app_user_id text,
  aliases text[] not null default '{}',
  latest_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.subscription_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text references public.subscription_products (id) on delete set null,
  entitlement_id text not null,
  provider public.billing_provider not null default 'revenuecat',
  platform public.purchase_platform not null default 'unknown',
  status public.entitlement_status not null default 'inactive',
  subscription_status public.subscription_status not null default 'free',
  starts_at timestamptz,
  expires_at timestamptz,
  will_renew boolean,
  store_transaction_id text,
  original_transaction_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entitlement_id, provider)
);

create table public.revenuecat_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  app_user_id text,
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  product_id text,
  entitlement_ids text[] not null default '{}',
  platform public.purchase_platform not null default 'unknown',
  purchased_at timestamptz,
  expiration_at timestamptz,
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.feature_access_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  feature_key text not null,
  granted boolean not null,
  reason text,
  created_at timestamptz not null default now()
);

create index subscription_products_active_idx on public.subscription_products (is_active);
create index revenuecat_customers_user_idx on public.revenuecat_customers (user_id);
create index subscription_entitlements_user_status_idx on public.subscription_entitlements (user_id, status, expires_at desc);
create index revenuecat_webhook_events_app_user_idx on public.revenuecat_webhook_events (app_user_id, created_at desc);
create index feature_access_audit_user_feature_idx on public.feature_access_audit (user_id, feature_key, created_at desc);

create trigger subscription_products_updated_at before update on public.subscription_products
  for each row execute function public.set_updated_at();
create trigger revenuecat_customers_updated_at before update on public.revenuecat_customers
  for each row execute function public.set_updated_at();
create trigger subscription_entitlements_updated_at before update on public.subscription_entitlements
  for each row execute function public.set_updated_at();

alter table public.subscription_products enable row level security;
alter table public.revenuecat_customers enable row level security;
alter table public.subscription_entitlements enable row level security;
alter table public.revenuecat_webhook_events enable row level security;
alter table public.feature_access_audit enable row level security;

create policy "Anyone can read active subscription products" on public.subscription_products
  for select using (is_active = true);

create policy "Users read own RevenueCat customer" on public.revenuecat_customers
  for select using (auth.uid() = user_id);

create policy "Users read own entitlements" on public.subscription_entitlements
  for select using (auth.uid() = user_id);

create policy "Users read own RevenueCat events" on public.revenuecat_webhook_events
  for select using (auth.uid() = user_id);

create policy "Users read own feature access audit" on public.feature_access_audit
  for select using (auth.uid() = user_id);

create or replace function public.user_has_entitlement(entitlement_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscription_entitlements entitlement
    where entitlement.user_id = auth.uid()
      and entitlement.entitlement_id = entitlement_key
      and entitlement.status = 'active'
      and entitlement.subscription_status in ('trialing', 'active', 'grace_period')
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  );
$$;

create or replace function public.user_can_view_reports()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_entitlement('premium_reports') or public.user_has_entitlement('elite_analytics');
$$;

create or replace function public.sync_profile_subscription_from_entitlements(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  has_active_premium boolean;
begin
  select exists (
    select 1
    from public.subscription_entitlements entitlement
    where entitlement.user_id = target_user_id
      and entitlement.status = 'active'
      and entitlement.subscription_status in ('trialing', 'active', 'grace_period')
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
  into has_active_premium;

  update public.profiles
  set
    tier = case when has_active_premium then 'premium'::public.subscription_tier else 'free'::public.subscription_tier end,
    subscription_tier = case when has_active_premium then 'premium'::public.subscription_tier else 'free'::public.subscription_tier end,
    premium_started_at = case when has_active_premium and premium_started_at is null then now() else premium_started_at end,
    premium_expires_at = (
      select max(entitlement.expires_at)
      from public.subscription_entitlements entitlement
      where entitlement.user_id = target_user_id
        and entitlement.status = 'active'
    )
  where id = target_user_id;
end;
$$;
