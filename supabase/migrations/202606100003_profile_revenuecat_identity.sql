update public.profiles
set revenuecat_app_user_id = id::text
where revenuecat_app_user_id is null;

create unique index if not exists profiles_revenuecat_app_user_id_idx
  on public.profiles (revenuecat_app_user_id)
  where revenuecat_app_user_id is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, tier, subscription_tier, revenuecat_app_user_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email), 'free', 'free', new.id::text)
  on conflict (id) do update set
    revenuecat_app_user_id = coalesce(public.profiles.revenuecat_app_user_id, new.id::text);

  return new;
end;
$$;
