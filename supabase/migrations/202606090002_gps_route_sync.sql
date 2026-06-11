alter table public.activities
  add column if not exists route_polyline text,
  add column if not exists route_summary_polyline text,
  add column if not exists route_map_id text,
  add column if not exists start_latitude numeric(10, 7),
  add column if not exists start_longitude numeric(10, 7),
  add column if not exists end_latitude numeric(10, 7),
  add column if not exists end_longitude numeric(10, 7),
  add column if not exists route_bounds jsonb not null default '{}'::jsonb,
  add column if not exists native_health_saved_at timestamptz;

create index if not exists activities_native_health_saved_at_idx
  on public.activities (user_id, native_health_saved_at desc)
  where source = 'xpirit_gps';

create index if not exists activities_route_map_id_idx
  on public.activities (route_map_id)
  where route_map_id is not null;
