-- Create table for premium report cards
create table if not exists public.premium_report_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start_date date not null,
  week_end_date date not null,
  title text not null,
  image_url text,
  metrics jsonb not null default '{}'::jsonb,
  visibility public.report_visibility not null default 'private',
  shared_at timestamptz,
  viewed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

-- Create index for efficient queries
create index if not exists idx_premium_report_cards_user_id on public.premium_report_cards(user_id);
create index if not exists idx_premium_report_cards_created_at on public.premium_report_cards(created_at desc);

-- Add column to profiles for tracking last report generation
alter table public.profiles
  add column if not exists last_report_generated_at timestamptz;
