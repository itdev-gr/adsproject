-- Many-to-many users ↔ workspaces with role
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner','admin','member')),
  joined_at    timestamptz default now() not null,
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index workspace_members_workspace_id_idx on public.workspace_members(workspace_id);

-- Trigger 1: when a workspace is created, insert the owner as a member
create or replace function public.handle_new_workspace()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Trigger 2: when a member's role becomes 'owner', atomically demote the previous owner
-- and update workspaces.owner_id (implements ownership transfer atomically)
create or replace function public.handle_owner_role_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role = 'owner' then
    update public.workspace_members
       set role = 'admin'
     where workspace_id = new.workspace_id
       and user_id <> new.user_id
       and role = 'owner';
    update public.workspaces
       set owner_id = new.user_id, updated_at = now()
     where id = new.workspace_id;
  end if;
  return new;
end;
$$;

create trigger on_owner_role_change
  after insert or update on public.workspace_members
  for each row when (new.role = 'owner')
  execute function public.handle_owner_role_change();

-- Backfill: every existing workspace's owner needs a member row
insert into public.workspace_members (workspace_id, user_id, role)
select id, owner_id, 'owner'
  from public.workspaces
  on conflict (workspace_id, user_id) do nothing;

-- RLS
alter table public.workspace_members enable row level security;

create policy members_select_same_workspace on public.workspace_members for select
  using (workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ));

create policy members_delete_admin_or_self on public.workspace_members for delete
  using (
    (workspace_id in (
       select workspace_id from public.workspace_members
       where user_id = auth.uid() and role in ('owner','admin')
     ) and role <> 'owner')
    or
    (user_id = auth.uid() and role <> 'owner')
  );

create policy members_update_admin on public.workspace_members for update
  using (workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  ))
  with check (
    (role <> 'owner') or
    (workspace_id in (
       select workspace_id from public.workspace_members
       where user_id = auth.uid() and role = 'owner'
     ))
  );
