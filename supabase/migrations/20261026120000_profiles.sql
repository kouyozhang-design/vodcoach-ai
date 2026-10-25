-- Profiles hold the plan. status becomes pro only from the server webhook
-- (service role). Authenticated users can read their own row and cannot write it.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  status text not null default 'free' check (status in ('free', 'pro')),
  stripe_customer_id text,
  updated_at timestamptz not null default now(),
  constraint profiles_stripe_customer_id_key unique (stripe_customer_id)
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, status)
  values (new.id, new.email, 'free')
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, status)
select id, email, 'free'
from auth.users
on conflict (id) do nothing;
