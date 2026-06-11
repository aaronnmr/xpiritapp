create extension if not exists "pgcrypto";

create type public.integration_provider as enum ('apple_healthkit', 'health_connect', 'oura', 'google_fit');
create type public.integration_status as enum ('active', 'revoked', 'expired', 'pending');
create type public.subscription_tier as enum ('free', 'premium');
create type public.activity_source as enum ('xpirit_gps', 'apple_healthkit', 'health_connect', 'oura', 'google_fit', 'manual');
create type public.activity_type as enum ('run', 'ride', 'swim', 'walk', 'hike', 'strength', 'mobility', 'other');
create type public.workout_status as enum ('planned', 'active', 'completed', 'abandoned');
create type public.timer_status as enum ('idle', 'running', 'paused', 'completed');
create type public.report_visibility as enum ('private', 'shared');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'UTC',
  tier public.subscription_tier not null default 'free',
  premium_started_at timestamptz,
  premium_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider public.integration_provider not null,
  provider_user_id text,
  status public.integration_status not null default 'pending',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  integration_id uuid references public.user_integrations (id) on delete set null,
  source public.activity_source not null,
  source_activity_id text,
  type public.activity_type not null default 'other',
  name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  moving_seconds integer check (moving_seconds is null or moving_seconds >= 0),
  distance_meters numeric(10, 2) check (distance_meters is null or distance_meters >= 0),
  elevation_gain_meters numeric(10, 2),
  average_heart_rate numeric(6, 2),
  max_heart_rate numeric(6, 2),
  calories numeric(10, 2),
  effort_score numeric(8, 2),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_activity_id)
);

create table public.daily_health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  integration_id uuid references public.user_integrations (id) on delete set null,
  source public.activity_source not null,
  measured_on date not null,
  readiness_score numeric(5, 2),
  sleep_score numeric(5, 2),
  sleep_minutes integer check (sleep_minutes is null or sleep_minutes >= 0),
  resting_heart_rate numeric(6, 2),
  hrv_ms numeric(8, 2),
  body_temperature_delta numeric(5, 2),
  respiratory_rate numeric(6, 2),
  steps integer check (steps is null or steps >= 0),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, measured_on)
);

create table public.gym_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Gym session',
  notes text,
  status public.workout_status not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.gym_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gym_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.gym_exercises (id) on delete cascade,
  workout_id uuid not null references public.gym_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  position integer not null default 0,
  reps integer check (reps is null or reps >= 0),
  weight_kg numeric(8, 2) check (weight_kg is null or weight_kg >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  distance_meters numeric(10, 2) check (distance_meters is null or distance_meters >= 0),
  perceived_effort integer check (perceived_effort between 1 and 10),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interval_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid references public.gym_workouts (id) on delete set null,
  activity_seconds integer not null check (activity_seconds > 0),
  rest_seconds integer not null check (rest_seconds >= 0),
  repeats integer not null check (repeats > 0),
  current_repeat integer not null default 0 check (current_repeat >= 0),
  status public.timer_status not null default 'idle',
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  background_task_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier public.subscription_tier not null,
  provider text,
  provider_event_id text,
  starts_at timestamptz,
  expires_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table public.report_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  period_start date not null,
  period_end date not null,
  aspect_ratio text not null default '9:16',
  visibility public.report_visibility not null default 'private',
  image_url text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.integration_provider not null,
  provider_event_id text,
  object_type text,
  object_id text,
  event_type text,
  user_id uuid references public.profiles (id) on delete set null,
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index activities_user_started_at_idx on public.activities (user_id, started_at desc);
create index activities_source_lookup_idx on public.activities (source, source_activity_id);
create index daily_health_metrics_user_date_idx on public.daily_health_metrics (user_id, measured_on desc);
create index gym_workouts_user_started_at_idx on public.gym_workouts (user_id, started_at desc);
create index gym_exercises_workout_position_idx on public.gym_exercises (workout_id, position);
create index gym_sets_exercise_position_idx on public.gym_sets (exercise_id, position);
create index interval_timers_user_status_idx on public.interval_timers (user_id, status);
create index report_cards_user_period_idx on public.report_cards (user_id, period_start desc, period_end desc);
create index webhook_events_provider_object_idx on public.webhook_events (provider, object_type, object_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_integrations_updated_at before update on public.user_integrations
  for each row execute function public.set_updated_at();
create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();
create trigger daily_health_metrics_updated_at before update on public.daily_health_metrics
  for each row execute function public.set_updated_at();
create trigger gym_workouts_updated_at before update on public.gym_workouts
  for each row execute function public.set_updated_at();
create trigger gym_exercises_updated_at before update on public.gym_exercises
  for each row execute function public.set_updated_at();
create trigger gym_sets_updated_at before update on public.gym_sets
  for each row execute function public.set_updated_at();
create trigger interval_timers_updated_at before update on public.interval_timers
  for each row execute function public.set_updated_at();
create trigger report_cards_updated_at before update on public.report_cards
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_integrations enable row level security;
alter table public.activities enable row level security;
alter table public.daily_health_metrics enable row level security;
alter table public.gym_workouts enable row level security;
alter table public.gym_exercises enable row level security;
alter table public.gym_sets enable row level security;
alter table public.interval_timers enable row level security;
alter table public.subscription_events enable row level security;
alter table public.report_cards enable row level security;
alter table public.webhook_events enable row level security;

create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage own integrations" on public.user_integrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own activities" on public.activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own health metrics" on public.daily_health_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own workouts" on public.gym_workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own exercises" on public.gym_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own sets" on public.gym_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own timers" on public.interval_timers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users read own subscription events" on public.subscription_events
  for select using (auth.uid() = user_id);

create policy "Users manage own reports" on public.report_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users read own webhook events" on public.webhook_events
  for select using (auth.uid() = user_id);
