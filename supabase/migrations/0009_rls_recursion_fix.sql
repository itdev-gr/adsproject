-- Fix: RLS policies on workspace_members and workspaces self-reference workspace_members,
-- which Postgres rejects with "infinite recursion detected in policy for relation".
--
-- Standard Supabase pattern: use a SECURITY DEFINER function that bypasses RLS for
-- the membership lookup. The function runs as the table owner (postgres role) so it
-- skips RLS, but it still uses auth.uid() to scope to the caller.

create or replace function public.user_workspace_ids()
returns table(workspace_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select wm.workspace_id from public.workspace_members wm where wm.user_id = auth.uid();
$$;

create or replace function public.user_workspace_ids_with_role(roles text[])
returns table(workspace_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select wm.workspace_id from public.workspace_members wm
   where wm.user_id = auth.uid() and wm.role = any(roles);
$$;

-- Lock down the helpers so only authenticated users can call them.
revoke execute on function public.user_workspace_ids() from public;
revoke execute on function public.user_workspace_ids_with_role(text[]) from public;
grant execute on function public.user_workspace_ids() to authenticated;
grant execute on function public.user_workspace_ids_with_role(text[]) to authenticated;

-- ────────── workspaces policies ──────────
drop policy if exists workspaces_select_member on public.workspaces;
drop policy if exists workspaces_update_admin on public.workspaces;
drop policy if exists workspaces_delete_owner on public.workspaces;

create policy workspaces_select_member on public.workspaces for select
  using (id in (select workspace_id from public.user_workspace_ids()));

create policy workspaces_update_admin on public.workspaces for update
  using (id in (select workspace_id from public.user_workspace_ids_with_role(array['owner','admin'])))
  with check (id in (select workspace_id from public.user_workspace_ids_with_role(array['owner','admin'])));

create policy workspaces_delete_owner on public.workspaces for delete
  using (id in (select workspace_id from public.user_workspace_ids_with_role(array['owner'])));

-- ────────── workspace_members policies ──────────
drop policy if exists members_select_same_workspace on public.workspace_members;
drop policy if exists members_delete_admin_or_self on public.workspace_members;
drop policy if exists members_update_admin on public.workspace_members;

create policy members_select_same_workspace on public.workspace_members for select
  using (workspace_id in (select workspace_id from public.user_workspace_ids()));

create policy members_delete_admin_or_self on public.workspace_members for delete
  using (
    (workspace_id in (select workspace_id from public.user_workspace_ids_with_role(array['owner','admin']))
       and role <> 'owner')
    or
    (user_id = auth.uid() and role <> 'owner')
  );

create policy members_update_admin on public.workspace_members for update
  using (workspace_id in (select workspace_id from public.user_workspace_ids_with_role(array['owner','admin'])))
  with check (
    (role <> 'owner')
    or
    (workspace_id in (select workspace_id from public.user_workspace_ids_with_role(array['owner'])))
  );

-- ────────── invitations policies ──────────
drop policy if exists invitations_select_admin_or_invitee on public.invitations;
drop policy if exists invitations_insert_admin on public.invitations;
drop policy if exists invitations_delete_admin_or_invitee on public.invitations;

create policy invitations_select_admin_or_invitee on public.invitations for select
  using (
    workspace_id in (select workspace_id from public.user_workspace_ids_with_role(array['owner','admin']))
    or lower(email) = (select lower(coalesce(email, '')) from auth.users where id = auth.uid())
  );

create policy invitations_insert_admin on public.invitations for insert
  with check (workspace_id in (select workspace_id from public.user_workspace_ids_with_role(array['owner','admin'])));

create policy invitations_delete_admin_or_invitee on public.invitations for delete
  using (
    workspace_id in (select workspace_id from public.user_workspace_ids_with_role(array['owner','admin']))
    or lower(email) = (select lower(coalesce(email, '')) from auth.users where id = auth.uid())
  );
