-- Signed-in analyses. user_id is the profiles id (the same auth user id).
-- Authenticated users read and write only their own rows. The service role
-- is not used here. The plan column on profiles is not written.

create table if not exists public.saved_analyses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  id text not null,
  saved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  payload jsonb not null,
  primary key (user_id, id)
);

alter table public.saved_analyses enable row level security;

revoke all on table public.saved_analyses from public, anon, authenticated;
grant select, insert, update, delete on table public.saved_analyses to authenticated;

drop policy if exists "saved_analyses_select_own" on public.saved_analyses;
create policy "saved_analyses_select_own"
  on public.saved_analyses
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "saved_analyses_insert_own" on public.saved_analyses;
create policy "saved_analyses_insert_own"
  on public.saved_analyses
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "saved_analyses_update_own" on public.saved_analyses;
create policy "saved_analyses_update_own"
  on public.saved_analyses
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "saved_analyses_delete_own" on public.saved_analyses;
create policy "saved_analyses_delete_own"
  on public.saved_analyses
  for delete
  to authenticated
  using (auth.uid() = user_id);
