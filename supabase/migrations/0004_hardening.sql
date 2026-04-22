-- Tighten avatars storage UPDATE policy: prevent renaming objects across UID prefixes
drop policy if exists "users can update own avatar" on storage.objects;
create policy "users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Auto-bump updated_at via moddatetime extension trigger
create extension if not exists moddatetime schema extensions;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function extensions.moddatetime(updated_at);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function extensions.moddatetime(updated_at);
