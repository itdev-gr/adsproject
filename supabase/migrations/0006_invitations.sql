create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email        text not null,
  role         text not null check (role in ('admin','member')),
  token        text unique not null default encode(extensions.gen_random_bytes(24), 'base64'),
  invited_by   uuid references auth.users(id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create unique index invitations_unique_pending
  on public.invitations(workspace_id, email)
  where accepted_at is null;
create index invitations_email_idx on public.invitations(email) where accepted_at is null;
create index invitations_token_idx on public.invitations(token);

-- Trigger: normalise email to lowercase on insert/update
create or replace function public.normalise_invitation_email()
returns trigger language plpgsql
as $$
begin
  new.email = lower(new.email);
  return new;
end;
$$;

create trigger on_invitation_email_normalise
  before insert or update on public.invitations
  for each row execute function public.normalise_invitation_email();

-- RLS
alter table public.invitations enable row level security;

create policy invitations_select_admin_or_invitee on public.invitations for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
    or lower(email) = (select lower(coalesce(email, '')) from auth.users where id = auth.uid())
  );

create policy invitations_insert_admin on public.invitations for insert
  with check (workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  ));

create policy invitations_delete_admin_or_invitee on public.invitations for delete
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
    or lower(email) = (select lower(coalesce(email, '')) from auth.users where id = auth.uid())
  );

-- No UPDATE policy: only the acceptInvitation server action (service role) writes accepted_at.
