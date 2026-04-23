-- Drop Foundation's owner-only policies; insert policy stays
drop policy if exists workspaces_select_own on public.workspaces;
drop policy if exists workspaces_update_own on public.workspaces;
drop policy if exists workspaces_delete_own on public.workspaces;

-- New policies: any member can SELECT, owner+admin can UPDATE, owner-only DELETE
create policy workspaces_select_member on public.workspaces for select
  using (id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy workspaces_update_admin on public.workspaces for update
  using (id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  ))
  with check (id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  ));

create policy workspaces_delete_owner on public.workspaces for delete
  using (id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role = 'owner'
  ));

-- workspaces_insert_own from Foundation stays (owner_id = auth.uid())

-- Hardening: enforce "exactly one owner per workspace" at DB layer.
-- Without this, two concurrent ownership-transfer transactions can both succeed
-- (each demotes the other's prior owner), leaving the table with two 'owner' rows.
-- This partial unique index makes the second concurrent transfer fail cleanly with
-- a unique-violation, which the action layer can surface as "try again".
create unique index workspace_members_one_owner_idx
  on public.workspace_members(workspace_id)
  where role = 'owner';
