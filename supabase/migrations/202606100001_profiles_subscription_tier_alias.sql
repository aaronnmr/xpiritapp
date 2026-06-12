alter table public.profiles
  add column if not exists subscription_tier public.subscription_tier not null default 'free';

update public.profiles
set subscription_tier = tier
where subscription_tier is distinct from tier;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, tier, subscription_tier)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email), 'free', 'free')
  on conflict (id) do nothing;

  return new;
end;
$$;
