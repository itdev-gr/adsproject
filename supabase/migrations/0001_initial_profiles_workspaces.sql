create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index workspaces_owner_id_idx on public.workspaces(owner_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;

create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_select_own on public.workspaces for select using (owner_id = auth.uid());
create policy workspaces_insert_own on public.workspaces for insert with check (owner_id = auth.uid());
create policy workspaces_update_own on public.workspaces for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy workspaces_delete_own on public.workspaces for delete using (owner_id = auth.uid());
