do $$
begin
  if not exists (select 1 from pg_type where typname = 'device_platform' and typnamespace = 'public'::regnamespace) then
    create type public.device_platform as enum ('ios', 'android', 'web', 'unknown');
  end if;

  if not exists (select 1 from pg_type where typname = 'body_sex' and typnamespace = 'public'::regnamespace) then
    create type public.body_sex as enum ('female', 'male', 'other', 'prefer_not_to_say');
  end if;

  if not exists (select 1 from pg_type where typname = 'measurement_system' and typnamespace = 'public'::regnamespace) then
    create type public.measurement_system as enum ('metric', 'imperial');
  end if;

  if not exists (select 1 from pg_type where typname = 'achievement_kind' and typnamespace = 'public'::regnamespace) then
    create type public.achievement_kind as enum ('distance', 'pace', 'streak', 'strength', 'consistency', 'recovery');
  end if;
end $$;

alter type public.subscription_tier add value if not exists 'elite';

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists date_of_birth date,
  add column if not exists sex public.body_sex,
  add column if not exists height_cm numeric(5, 2) check (height_cm is null or height_cm > 0),
  add column if not exists weight_kg numeric(6, 2) check (weight_kg is null or weight_kg > 0),
  add column if not exists locale text not null default 'en',
  add column if not exists measurement_system public.measurement_system not null default 'metric',
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists last_active_at timestamptz;

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  installation_id text not null,
  platform public.device_platform not null default 'unknown',
  device_name text,
  push_token text,
  app_version text,
  os_version text,
  timezone text not null default 'UTC',
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, installation_id)
);

create table if not exists public.activity_route_points (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  altitude_meters numeric(10, 2),
  accuracy_meters numeric(10, 2),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (activity_id, sequence)
);

create table if not exists public.training_load_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null,
  workout_count integer not null default 0 check (workout_count >= 0),
  run_distance_meters numeric(12, 2) not null default 0 check (run_distance_meters >= 0),
  active_seconds integer not null default 0 check (active_seconds >= 0),
  strength_volume_kg numeric(14, 2) not null default 0 check (strength_volume_kg >= 0),
  recovery_hours_recommended numeric(6, 2),
  load_score numeric(8, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

create table if not exists public.achievements (
  id text primary key,
  kind public.achievement_kind not null,
  title text not null,
  description text,
  threshold numeric(12, 2),
  unit text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  source_activity_id uuid references public.activities (id) on delete set null,
  progress numeric(12, 2),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, achievement_id)
);

create table if not exists public.report_assets (
  id uuid primary key default gen_random_uuid(),
  report_card_id uuid not null references public.report_cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_bucket text,
  storage_path text,
  public_url text,
  mime_type text not null default 'image/png',
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event_name text not null,
  screen_name text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.achievements (id, kind, title, description, threshold, unit)
values
  ('first_run', 'consistency', 'First Run', 'Complete your first tracked run.', 1, 'run'),
  ('five_k_run', 'distance', '5K Complete', 'Run at least 5 kilometers in one session.', 5000, 'meters'),
  ('ten_sessions', 'consistency', '10 Sessions', 'Complete ten workouts in Xpirit.', 10, 'workouts'),
  ('strength_1000kg', 'strength', '1,000 kg Volume', 'Log at least 1,000 kg of total gym volume in one session.', 1000, 'kg')
on conflict (id) do update set
  kind = excluded.kind,
  title = excluded.title,
  description = excluded.description,
  threshold = excluded.threshold,
  unit = excluded.unit,
  updated_at = now();

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_last_active_idx on public.profiles (last_active_at desc);
create index if not exists user_devices_user_seen_idx on public.user_devices (user_id, last_seen_at desc);
create index if not exists activity_route_points_activity_sequence_idx on public.activity_route_points (activity_id, sequence);
create index if not exists training_load_daily_user_date_idx on public.training_load_daily (user_id, measured_on desc);
create index if not exists achievements_active_kind_idx on public.achievements (is_active, kind);
create index if not exists user_achievements_user_unlocked_idx on public.user_achievements (user_id, unlocked_at desc);
create index if not exists report_assets_report_idx on public.report_assets (report_card_id);
create index if not exists app_events_user_created_idx on public.app_events (user_id, created_at desc);
create index if not exists app_events_name_created_idx on public.app_events (event_name, created_at desc);

create trigger user_devices_updated_at before update on public.user_devices
  for each row execute function public.set_updated_at();
create trigger training_load_daily_updated_at before update on public.training_load_daily
  for each row execute function public.set_updated_at();
create trigger achievements_updated_at before update on public.achievements
  for each row execute function public.set_updated_at();

alter table public.user_devices enable row level security;
alter table public.activity_route_points enable row level security;
alter table public.training_load_daily enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.report_assets enable row level security;
alter table public.app_events enable row level security;

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users manage own devices" on public.user_devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own route points" on public.activity_route_points
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users read own daily training load" on public.training_load_daily
  for select using (auth.uid() = user_id);

create policy "Anyone can read active achievements" on public.achievements
  for select using (is_active = true);

create policy "Users read own achievements" on public.user_achievements
  for select using (auth.uid() = user_id);

create policy "Users manage own report assets" on public.report_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users insert own app events" on public.app_events
  for insert with check (auth.uid() = user_id or user_id is null);

create policy "Users read own app events" on public.app_events
  for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    full_name,
    email,
    subscription_tier,
    tier,
    revenuecat_app_user_id,
    google_sign_in_enabled,
    apple_sign_in_enabled
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    'free',
    'free',
    new.id::text,
    exists (select 1 from jsonb_array_elements_text(coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb)) provider where provider = 'google'),
    exists (select 1 from jsonb_array_elements_text(coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb)) provider where provider = 'apple')
  )
  on conflict (id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    email = coalesce(public.profiles.email, excluded.email),
    revenuecat_app_user_id = coalesce(public.profiles.revenuecat_app_user_id, excluded.revenuecat_app_user_id),
    google_sign_in_enabled = public.profiles.google_sign_in_enabled or excluded.google_sign_in_enabled,
    apple_sign_in_enabled = public.profiles.apple_sign_in_enabled or excluded.apple_sign_in_enabled,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.touch_profile_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set last_active_at = now()
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists activities_touch_profile_activity on public.activities;
create trigger activities_touch_profile_activity
  after insert on public.activities
  for each row execute function public.touch_profile_activity();

drop trigger if exists gym_sets_touch_profile_activity on public.gym_sets;
create trigger gym_sets_touch_profile_activity
  after insert on public.gym_sets
  for each row execute function public.touch_profile_activity();
