-- Fix: ownership-transfer trigger must fire BEFORE the unique-index check.
-- The non-deferrable workspace_members_one_owner_idx (added in 0007) checks
-- uniqueness BEFORE AFTER triggers fire, so an UPDATE that promotes a member
-- to 'owner' is rejected with 23505 before the AFTER trigger can demote the
-- previous owner.
--
-- Switching to BEFORE means the demotion of the previous owner (a side-effect
-- update to a different row) commits inside the same transaction, becomes
-- visible to subsequent constraint evaluation, and the unique check then sees
-- only one 'owner' row.

drop trigger if exists on_owner_role_change on public.workspace_members;

create trigger on_owner_role_change
  before insert or update on public.workspace_members
  for each row when (new.role = 'owner')
  execute function public.handle_owner_role_change();

-- The function body itself is unchanged — it already does the right thing
-- (demote prior owners, sync workspaces.owner_id). Only the timing changes.
