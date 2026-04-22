# Workspaces & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-tenant workspaces to autoads — many-to-many users↔workspaces with `owner`/`admin`/`member` roles, email + shareable-link invitations, URL-scoped workspace pages (`/app/w/<slug>/...`).

**Architecture:** Three new DB layers (`workspace_members` join + `invitations` table + 4 triggers), full RLS rewrite from Foundation's owner-only policies to membership-aware ones, two distinct app-layout shells (personal vs workspace), public `/invite/[token]` landing, plus 9 new Server Actions and 3 edited Foundation actions.

**Tech Stack:** Next.js 16 + React 19 + TS strict, Supabase (Postgres + Auth, hosted at `utytknefnlgjrhguazvn.supabase.co`), shadcn/ui (base-nova), `@supabase/ssr`, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-23-workspaces-design.md`

**Builds on:** Foundation (`docs/superpowers/specs/2026-04-22-foundation-design.md`, 36 commits already on `main`).

---

## Environment notes (every implementer subagent must read this)

**Node:** Always prefix bash with:
```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && <cmd>
```
Verify `node --version` = `v20.20.2`. STOP if not.

**Supabase env:** For migration pushes and type generation, source `.env.local`:
```bash
set -a && source /Users/marios/Desktop/Cursor/autoads/.env.local && set +a
```
The CLI is at `/Users/marios/bin/supabase` (v2.90.0+). Project linked to `utytknefnlgjrhguazvn`.

**Type regen after migrations:** After any schema change, run `pnpm db:types` to regenerate `src/db/types.ts`. Commit the regenerated file.

**Next.js 16:** Read `AGENTS.md` at the project root before writing Next.js code. Notable: `proxy.ts` not `middleware.ts`; `cookies()` is async; `<form action={fn}>` requires `void | Promise<void>` so wrap actions returning data in inline `'use server'` closures.

**shadcn base-nova:** This codebase uses `base-nova` style with `@base-ui/react`, NOT classic `@radix-ui`. Use `<Component render={<OtherComponent />}>` instead of `asChild`. `DropdownMenuLabel` requires being inside `<DropdownMenuGroup>` — prefer plain `<div>` for static labels.

**Quality gates after each task:**
```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```
All must exit 0. (Vitest was removed during simplification; only Playwright E2E remains.)

**Commit + push pattern:** Each task ends with one focused commit. Push after every task — Vercel auto-deploys from `main`, so verify the deploy succeeds before moving on.

---

## File Structure (target end-state)

```
supabase/migrations/
├── 0001_initial_profiles_workspaces.sql      (existing)
├── 0002_signup_trigger.sql                    (existing)
├── 0003_avatars_bucket.sql                    (existing)
├── 0004_hardening.sql                         (existing)
├── 0005_workspace_members.sql                 (NEW — Task 1)
├── 0006_invitations.sql                       (NEW — Task 2)
└── 0007_workspaces_rls_rewrite.sql            (NEW — Task 3)

src/
├── proxy.ts                                   (MODIFIED — Task 8)
├── lib/
│   ├── auth/membership.ts                     (NEW — Task 5)
│   └── actions/
│       ├── auth.ts                            (MODIFIED — Task 7: invite_token in signUp/logIn)
│       ├── account.ts                         (MODIFIED — Task 7: last-owner check)
│       ├── onboarding.ts                      (existing — unchanged)
│       ├── profile.ts                         (existing — unchanged)
│       ├── workspace.ts                       (MODIFIED — Task 7: scoped by slug)
│       └── workspaces.ts                      (NEW — Task 6: 9 actions)
├── components/
│   ├── ui/select.tsx                          (NEW — Task 4)
│   ├── ui/table.tsx                           (NEW — Task 4)
│   └── app/
│       ├── workspace-switcher.tsx             (NEW — Task 12)
│       ├── create-workspace-dialog.tsx        (NEW — Task 12)
│       ├── workspace-members-table.tsx        (NEW — Task 13)
│       ├── role-select.tsx                    (NEW — Task 13)
│       ├── remove-member-button.tsx           (NEW — Task 13)
│       ├── invite-section.tsx                 (NEW — Task 14)
│       ├── pending-invitations-list.tsx       (NEW — Task 14)
│       ├── invite-accept-card.tsx             (NEW — Task 16)
│       ├── transfer-ownership-form.tsx        (NEW — Task 15)
│       ├── delete-workspace-form.tsx          (NEW — Task 15)
│       └── pending-invites-banner.tsx         (NEW — Task 17)
└── app/
    ├── invite/[token]/page.tsx                (NEW — Task 16)
    ├── app/
    │   ├── layout.tsx                         (MODIFIED — Task 9: personal-only chrome)
    │   ├── page.tsx                           (MODIFIED — Task 9: new redirect logic)
    │   ├── invitations/page.tsx               (NEW — Task 17)
    │   ├── settings/                          (existing /profile and /account, unchanged)
    │   └── w/[slug]/
    │       ├── layout.tsx                     (NEW — Task 10: workspace chrome)
    │       ├── page.tsx                       (NEW — Task 10: redirect to /dashboard)
    │       ├── dashboard/page.tsx             (MOVED from /app/dashboard — Task 10)
    │       ├── campaigns/page.tsx             (MOVED — Task 10)
    │       ├── connections/page.tsx           (MOVED — Task 10)
    │       ├── automation/page.tsx            (MOVED — Task 10)
    │       ├── reports/page.tsx               (MOVED — Task 10)
    │       └── settings/
    │           ├── layout.tsx                 (NEW — Task 11: workspace settings tabs)
    │           ├── general/page.tsx           (MOVED + RENAMED from /app/settings/workspace — Task 11)
    │           ├── members/page.tsx           (NEW — Task 13)
    │           └── danger/page.tsx            (NEW — Task 15)
    └── (other unchanged)

tests/e2e/
├── auth.spec.ts                               (existing — verify still passes)
├── marketing.spec.ts                          (existing — verify still passes)
├── workspaces.spec.ts                         (NEW — Task 18)
└── invite.spec.ts                             (NEW — Task 19)

docs/superpowers/specs/2026-04-22-foundation-design.md   (MODIFIED — Task 11: note moved settings page)
```

Files to **delete** (Foundation paths replaced by `/app/w/[slug]/...` versions):
- `src/app/app/dashboard/`, `src/app/app/campaigns/`, `src/app/app/connections/`, `src/app/app/automation/`, `src/app/app/reports/` — directories deleted as part of Task 10
- `src/app/app/settings/workspace/` — directory deleted as part of Task 11

---

## Task 1: Migration 0005 — `workspace_members` table + triggers + RLS

**Files:**
- Create: `supabase/migrations/0005_workspace_members.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0005_workspace_members.sql`:
```sql
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
    -- Downgrade existing owner (if different from new) to admin
    update public.workspace_members
       set role = 'admin'
     where workspace_id = new.workspace_id
       and user_id <> new.user_id
       and role = 'owner';
    -- Sync the denormalised owner_id on workspaces
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
-- (Foundation created workspaces before this table existed)
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

-- No INSERT policy: client INSERTs blocked. Server actions use service role.

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
```

- [ ] **Step 2: Push to hosted DB**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && set -a && source .env.local && set +a && yes | supabase db push --linked
```
Expected: `Applying migration 0005_workspace_members.sql...` then `Finished supabase db push.`

- [ ] **Step 3: Verify backfill**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && set -a && source .env.local && set +a && supabase migration list --linked | tail -8
```
Expected: `0005` shows in both Local and Remote.

If you have `psql` available:
```bash
PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's|.*postgres:([^@]*)@.*|\1|') psql "${DATABASE_URL}" -c "select count(*) as workspace_count, count(distinct workspace_id) as members_workspace_count from public.workspaces full outer join public.workspace_members on public.workspaces.id = workspace_members.workspace_id;"
```
Otherwise just trust the migration ran cleanly (the SQL is idempotent on conflict).

- [ ] **Step 4: Regenerate types**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && set -a && source .env.local && set +a && pnpm db:types && wc -l src/db/types.ts
```
Expected: file size grows to include `workspace_members` table type.

- [ ] **Step 5: Quality gates**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 6: Commit + push**

```bash
git add -A && git commit -m "feat(db): add workspace_members table with role + triggers + RLS" && git push
```

---

## Task 2: Migration 0006 — `invitations` table + email-normalisation trigger + RLS

**Files:**
- Create: `supabase/migrations/0006_invitations.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0006_invitations.sql`:
```sql
create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email        text not null,
  role         text not null check (role in ('admin','member')),
  token        text unique not null default encode(gen_random_bytes(24), 'base64'),
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
```

> Note: the spec used `'base64url'` for the token encoding. Postgres' built-in `encode()` doesn't have `'base64url'` — `'base64'` is closest. We strip URL-unsafe characters in the action layer (replace `+/=` with `-_` and trim) when generating the link. See Task 6 for the helper.

- [ ] **Step 2: Push**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && set -a && source .env.local && set +a && yes | supabase db push --linked
```
Expected: `Applying migration 0006_invitations.sql...` then `Finished supabase db push.`

- [ ] **Step 3: Regenerate types + commit**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && set -a && source .env.local && set +a && pnpm db:types && pnpm format && pnpm lint && pnpm typecheck && pnpm build && git add -A && git commit -m "feat(db): add invitations table with email normalisation + RLS" && git push
```

---

## Task 3: Migration 0007 — rewrite `workspaces` RLS to use member relationships

**Files:**
- Create: `supabase/migrations/0007_workspaces_rls_rewrite.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0007_workspaces_rls_rewrite.sql`:
```sql
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
```

- [ ] **Step 2: Push**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && set -a && source .env.local && set +a && yes | supabase db push --linked
```

- [ ] **Step 3: Regenerate types + commit (build will pass — RLS doesn't affect TS types)**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && set -a && source .env.local && set +a && pnpm db:types && pnpm format && pnpm lint && pnpm typecheck && pnpm build && git add -A && git commit -m "feat(db): rewrite workspaces RLS to use member relationships" && git push
```

---

## Task 4: Add shadcn `select` and `table` primitives

**Files:**
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/table.tsx`

- [ ] **Step 1: Add primitives**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && pnpm dlx shadcn@latest add select table --yes
```
Expected: both files created in `src/components/ui/`.

- [ ] **Step 2: Verify quality gates**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 3: Commit + push**

```bash
git add -A && git commit -m "feat(ui): add shadcn select + table primitives" && git push
```

---

## Task 5: Membership helper — `src/lib/auth/membership.ts`

**Files:**
- Create: `src/lib/auth/membership.ts`

- [ ] **Step 1: Write the helper**

`src/lib/auth/membership.ts`:
```ts
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface Membership {
  role: WorkspaceRole
  workspaceId: string
  workspaceName: string
}

/**
 * Returns the caller's membership in the workspace identified by `slug`,
 * or null if not authenticated or not a member.
 */
export async function getMembership(slug: string): Promise<Membership | null> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null

  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, workspace_members!inner(role)')
    .eq('slug', slug)
    .eq('workspace_members.user_id', userData.user.id)
    .maybeSingle()

  if (error || !data) return null
  const memberRow = Array.isArray(data.workspace_members)
    ? data.workspace_members[0]
    : data.workspace_members
  if (!memberRow) return null
  return {
    role: memberRow.role as WorkspaceRole,
    workspaceId: data.id,
    workspaceName: data.name,
  }
}

/** Throws redirect to /app if not a member of `slug`. */
export async function requireMember(slug: string): Promise<Membership> {
  const m = await getMembership(slug)
  if (!m) redirect('/app')
  return m
}

/** Throws redirect to /app/w/<slug>/dashboard if role not in `allowed`. */
export async function requireRole(
  slug: string,
  allowed: WorkspaceRole[],
): Promise<Membership> {
  const m = await requireMember(slug)
  if (!allowed.includes(m.role)) redirect(`/app/w/${slug}/dashboard`)
  return m
}
```

- [ ] **Step 2: Quality gates**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 3: Commit + push**

```bash
git add -A && git commit -m "feat(auth): add membership helper (getMembership + requireMember + requireRole)" && git push
```

---

## Task 6: Workspace Server Actions — `src/lib/actions/workspaces.ts`

**Files:**
- Create: `src/lib/actions/workspaces.ts`

- [ ] **Step 1: Write all 9 actions**

`src/lib/actions/workspaces.ts`:
```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { ensureUniqueSlug, slugify } from '@/lib/slug'
import { requireRole, requireMember } from '@/lib/auth/membership'

const RECENT_COOKIE = 'recent_workspace_slug'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: '/',
}

function admin() {
  return createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function makeUrlSafeToken(token: string) {
  return token.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

// ────────────── createWorkspace ──────────────

const createSchema = z.object({ name: z.string().min(1).max(60) })

export async function createWorkspace(formData: FormData) {
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Workspace name is required (max 60 chars).' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  const base = slugify(parsed.data.name)
  const slug = await ensureUniqueSlug(base, async (s) => {
    const { count } = await supabase
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('slug', s)
    return (count ?? 0) > 0
  })

  const { error } = await supabase
    .from('workspaces')
    .insert({ name: parsed.data.name, slug, owner_id: userData.user.id })
  if (error) return { error: error.message }

  ;(await cookies()).set(RECENT_COOKIE, slug, COOKIE_OPTS)
  redirect(`/app/w/${slug}/dashboard`)
}

// ────────────── inviteMember ──────────────

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
})

export async function inviteMember(slug: string, formData: FormData) {
  const m = await requireRole(slug, ['owner', 'admin'])

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Valid email and role required.' }

  const email = parsed.data.email.toLowerCase()
  const supabase = await createClient()

  // Insert invitation (DB trigger lowercases email; on conflict, take the existing row)
  const { data: existing } = await supabase
    .from('invitations')
    .select('id, token')
    .eq('workspace_id', m.workspaceId)
    .eq('email', email)
    .is('accepted_at', null)
    .maybeSingle()

  let invitationId: string
  let token: string

  if (existing) {
    invitationId = existing.id
    token = existing.token
  } else {
    const { data: inserted, error } = await supabase
      .from('invitations')
      .insert({
        workspace_id: m.workspaceId,
        email,
        role: parsed.data.role,
        invited_by: (await supabase.auth.getUser()).data.user!.id,
      })
      .select('id, token')
      .single()
    if (error || !inserted) return { error: error?.message ?? 'Failed to create invitation.' }
    invitationId = inserted.id
    token = inserted.token
  }

  const safeToken = makeUrlSafeToken(token)
  const link = `${env.NEXT_PUBLIC_SITE_URL}/invite/${safeToken}`

  // Send email via Supabase Auth admin (best-effort; failure to send doesn't undo the invite row)
  try {
    await admin().auth.admin.inviteUserByEmail(email, { redirectTo: link })
  } catch {
    // Swallow: invitation is in the DB, link is returned — UI shows copy-link path.
  }

  revalidatePath(`/app/w/${slug}/settings/members`)
  return { ok: true, invitationId, token: safeToken, link }
}

// ────────────── revokeInvitation ──────────────

export async function revokeInvitation(slug: string, invitationId: string) {
  await requireRole(slug, ['owner', 'admin'])
  const supabase = await createClient()
  const { error } = await supabase.from('invitations').delete().eq('id', invitationId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}/settings/members`)
  return { ok: true }
}

// ────────────── acceptInvitation ──────────────

export async function acceptInvitation(token: string) {
  if (!token) return { error: 'Missing token.' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  // Service-role lookup so we can read invites for any workspace
  const { data: invite, error: lookupErr } = await admin()
    .from('invitations')
    .select('id, workspace_id, email, role, expires_at, accepted_at, workspaces(slug, name)')
    .eq('token', token)
    .maybeSingle()
  if (lookupErr || !invite) return { error: 'Invitation not found.' }
  if (invite.accepted_at) return { error: 'Invitation already accepted.' }
  if (new Date(invite.expires_at).getTime() < Date.now()) return { error: 'Invitation expired.' }

  const callerEmail = (userData.user.email ?? '').toLowerCase()
  if (callerEmail !== invite.email.toLowerCase()) {
    return {
      error: `This invitation was sent to ${invite.email}. Sign in with that account to accept.`,
    }
  }

  // Insert membership via service role (no client INSERT policy)
  const { error: memberErr } = await admin()
    .from('workspace_members')
    .insert({
      workspace_id: invite.workspace_id,
      user_id: userData.user.id,
      role: invite.role,
    })
  if (memberErr) return { error: memberErr.message }

  // Mark accepted
  await admin().from('invitations').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id)

  const ws = Array.isArray(invite.workspaces) ? invite.workspaces[0] : invite.workspaces
  if (!ws) return { error: 'Workspace not found.' }

  ;(await cookies()).set(RECENT_COOKIE, ws.slug, COOKIE_OPTS)
  return { ok: true, slug: ws.slug }
}

// ────────────── declineInvitation ──────────────

export async function declineInvitation(invitationId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('invitations').delete().eq('id', invitationId)
  // RLS allows the invitee to delete their own pending invite
  if (error) return { error: error.message }
  revalidatePath('/app/invitations')
  return { ok: true }
}

// ────────────── removeMember ──────────────

export async function removeMember(slug: string, userId: string) {
  const m = await requireRole(slug, ['owner', 'admin'])
  if (userId === (await (await createClient()).auth.getUser()).data.user!.id && m.role === 'owner') {
    return { error: 'Owners cannot remove themselves. Transfer ownership first.' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', m.workspaceId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}/settings/members`)
  return { ok: true }
}

// ────────────── leaveWorkspace ──────────────

export async function leaveWorkspace(slug: string) {
  const m = await requireMember(slug)
  if (m.role === 'owner') return { error: 'Owners cannot leave. Transfer ownership or delete the workspace.' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', m.workspaceId)
    .eq('user_id', userData.user!.id)
  if (error) return { error: error.message }
  redirect('/app')
}

// ────────────── changeMemberRole ──────────────

const roleSchema = z.enum(['admin', 'member'])

export async function changeMemberRole(slug: string, userId: string, newRole: 'admin' | 'member') {
  const parsed = roleSchema.safeParse(newRole)
  if (!parsed.success) return { error: 'Invalid role.' }
  const m = await requireRole(slug, ['owner', 'admin'])

  const supabase = await createClient()
  const { error } = await supabase
    .from('workspace_members')
    .update({ role: parsed.data })
    .eq('workspace_id', m.workspaceId)
    .eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}/settings/members`)
  return { ok: true }
}

// ────────────── transferOwnership ──────────────

export async function transferOwnership(slug: string, newOwnerUserId: string) {
  const m = await requireRole(slug, ['owner'])

  const supabase = await createClient()
  // Update target's role to 'owner' — trigger atomically demotes current owner + updates owner_id
  const { error } = await supabase
    .from('workspace_members')
    .update({ role: 'owner' })
    .eq('workspace_id', m.workspaceId)
    .eq('user_id', newOwnerUserId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}/settings/members`)
  revalidatePath(`/app/w/${slug}/settings/danger`)
  return { ok: true }
}

// ────────────── deleteWorkspace ──────────────

export async function deleteWorkspace(slug: string) {
  const m = await requireRole(slug, ['owner'])
  const supabase = await createClient()
  const { error } = await supabase.from('workspaces').delete().eq('id', m.workspaceId)
  if (error) return { error: error.message }
  ;(await cookies()).delete(RECENT_COOKIE)
  redirect('/app')
}
```

- [ ] **Step 2: Quality gates**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

The `build` is the most likely failure point — generated `Database` types from `src/db/types.ts` may differ slightly from the assumed shapes. If so, adapt the `.from('...')` calls to match the generated types (e.g., the `workspace_members!inner(role)` join syntax may need adjustment).

- [ ] **Step 3: Commit + push**

```bash
git add -A && git commit -m "feat(actions): add 9 workspace Server Actions (create/invite/accept/role/transfer/delete/etc.)" && git push
```

---

## Task 7: Edit existing Foundation actions

**Files:**
- Modify: `src/lib/actions/account.ts` (last-owner protection)
- Modify: `src/lib/actions/workspace.ts` (scope by slug, requireRole)
- Modify: `src/lib/actions/auth.ts` (handle invite_token)

- [ ] **Step 1: Update `src/lib/actions/account.ts`**

Read the current file, then change `deleteAccount` to add the last-owner check:

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient as createServer } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export async function deleteAccount() {
  const supabase = await createServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { error: 'Not authenticated.' }

  // Last-owner protection: block deletion if user owns any multi-member workspace
  const { data: ownedRows } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces!inner(name, slug)')
    .eq('user_id', data.user.id)
    .eq('role', 'owner')

  if (ownedRows && ownedRows.length > 0) {
    const admin = createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    for (const row of ownedRows) {
      const { count } = await admin
        .from('workspace_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('workspace_id', row.workspace_id)
      if ((count ?? 0) > 1) {
        const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
        return {
          error: `You own "${ws?.name}" with other members. Transfer ownership or delete the workspace first.`,
          blockingWorkspaceSlug: ws?.slug,
        }
      }
    }
  }

  const admin = createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await admin.auth.admin.deleteUser(data.user.id)
  if (error) return { error: error.message }

  await supabase.auth.signOut()
  redirect('/')
}
```

- [ ] **Step 2: Update `src/lib/actions/workspace.ts` (scope by slug)**

Replace contents with:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/membership'

const schema = z.object({ name: z.string().min(1).max(60) })

export async function updateWorkspace(slug: string, formData: FormData) {
  const m = await requireRole(slug, ['owner', 'admin'])

  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid workspace name.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('workspaces')
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq('id', m.workspaceId)
  if (error) return { error: error.message }
  revalidatePath(`/app/w/${slug}`, 'layout')
  return { ok: true }
}
```

- [ ] **Step 3: Update `src/lib/actions/auth.ts` to handle invite_token**

Read the current file. Modify `signUp` and `logIn` to accept an optional `invite_token` parameter and call `acceptInvitation` after auth before redirecting:

Add at the top:
```ts
import { acceptInvitation } from '@/lib/actions/workspaces'
```

Modify `signUp`:
```ts
export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Please enter a valid email and password (8+ chars, letters + digits).' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password })
  if (error) return { error: error.message }

  const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data)
  if (signInError) return { error: signInError.message }

  const inviteToken = (formData.get('invite_token') as string | null)?.trim() || null
  if (inviteToken) {
    const result = await acceptInvitation(inviteToken)
    if ('slug' in result && result.slug) {
      redirect(`/app/w/${result.slug}/dashboard`)
    }
    // If acceptance failed (e.g. wrong email), fall through to onboarding so the user has somewhere to land.
  }

  redirect('/onboarding')
}
```

Modify `logIn` similarly:
```ts
export async function logIn(formData: FormData, redirectTo = '/app/dashboard') {
  const parsed = logInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid email or password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: 'Invalid email or password.' }

  const inviteToken = (formData.get('invite_token') as string | null)?.trim() || null
  if (inviteToken) {
    const result = await acceptInvitation(inviteToken)
    if ('slug' in result && result.slug) {
      redirect(`/app/w/${result.slug}/dashboard`)
    }
  }

  redirect(redirectTo)
}
```

- [ ] **Step 4: Update `(auth)/sign-up/page.tsx` and `(auth)/log-in/page.tsx` to forward `invite_token` in form**

For both pages, the form needs a hidden input with the `invite_token` query param value if present. Read both pages first, then add a hidden input:

```tsx
// inside the page (server component)
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ invite_token?: string; email?: string }> }) {
  const sp = await searchParams
  const inviteToken = sp.invite_token ?? ''
  const prefilledEmail = sp.email ?? ''
  return (
    <AuthCard ...>
      <form action={signUp} ...>
        {inviteToken && <input type="hidden" name="invite_token" value={inviteToken} />}
        <Input id="email" name="email" type="email" defaultValue={prefilledEmail} ... />
        ...
      </form>
    </AuthCard>
  )
}
```

For log-in, similar structure, but the existing closure that injects `redirectTo` needs to also forward `invite_token`. Reading the current log-in page first will show the existing closure pattern from Foundation.

- [ ] **Step 5: Quality gates**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 6: Commit + push**

```bash
git add -A && git commit -m "feat(actions): scope updateWorkspace by slug, last-owner protection in deleteAccount, invite_token in signUp/logIn" && git push
```

---

## Task 8: Update proxy — membership check + cookie write + back-compat redirects

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Read the current proxy**

```bash
cat src/proxy.ts
```

- [ ] **Step 2: Replace with the updated version**

`src/proxy.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = ['/app', '/onboarding']
const PUBLIC_AUTH_PATHS = ['/sign-up', '/log-in', '/forgot-password', '/reset-password']
const RECENT_COOKIE = 'recent_workspace_slug'

// Foundation paths that have moved into the workspace context — back-compat redirect target.
const MOVED_PATHS = new Set(['/dashboard', '/campaigns', '/connections', '/automation', '/reports'])

export async function proxy(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const isAuthPage = PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/log-in'
    url.searchParams.set('redirect', pathname)
    return redirectWithCookies(url, response)
  }

  if (user) {
    // Get all workspaces this user belongs to
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('role, workspaces!inner(slug)')
      .eq('user_id', user.id)
    const slugs: string[] = (memberships ?? [])
      .map((m) => {
        const w = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces
        return w?.slug ?? ''
      })
      .filter(Boolean)
    const hasWorkspace = slugs.length > 0

    // Anonymous-or-no-workspace handling: send to onboarding for /app/* or /onboarding
    if (pathname.startsWith('/app') && !hasWorkspace) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return redirectWithCookies(url, response)
    }
    if (pathname === '/onboarding' && hasWorkspace) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return redirectWithCookies(url, response)
    }
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return redirectWithCookies(url, response)
    }

    // Back-compat: old Foundation paths → /app/w/<recent>/<sub>
    if (hasWorkspace) {
      for (const moved of MOVED_PATHS) {
        if (pathname === `/app${moved}` || pathname.startsWith(`/app${moved}/`)) {
          const cookieSlug = request.cookies.get(RECENT_COOKIE)?.value
          const target = cookieSlug && slugs.includes(cookieSlug) ? cookieSlug : (slugs[0] ?? '')
          if (target) {
            const url = request.nextUrl.clone()
            url.pathname = `/app/w/${target}${moved}${pathname.slice(`/app${moved}`.length)}`
            return redirectWithCookies(url, response)
          }
        }
      }
      // Old workspace-settings path
      if (pathname === '/app/settings/workspace') {
        const cookieSlug = request.cookies.get(RECENT_COOKIE)?.value
        const target = cookieSlug && slugs.includes(cookieSlug) ? cookieSlug : (slugs[0] ?? '')
        if (target) {
          const url = request.nextUrl.clone()
          url.pathname = `/app/w/${target}/settings/general`
          return redirectWithCookies(url, response)
        }
      }
    }

    // Membership check + cookie write for /app/w/[slug]/*
    const wMatch = pathname.match(/^\/app\/w\/([^/]+)(\/|$)/)
    if (wMatch) {
      const slug = wMatch[1]!
      if (!slugs.includes(slug)) {
        const url = request.nextUrl.clone()
        url.pathname = '/app'
        return redirectWithCookies(url, response)
      }
      response.cookies.set(RECENT_COOKIE, slug, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
    }
  }

  return response
}

function redirectWithCookies(url: URL, sourceResponse: NextResponse) {
  const redirect = NextResponse.redirect(url)
  for (const cookie of sourceResponse.cookies.getAll()) {
    redirect.cookies.set(cookie.name, cookie.value, cookie)
  }
  return redirect
}

export const config = {
  matcher: [
    '/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)',
  ],
}
```

- [ ] **Step 3: Quality gates**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 4: Smoke test (anonymous redirects still work)**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
pnpm dev > /tmp/autoads-task8.log 2>&1 &
DEV_PID=$!
sleep 12
echo "Anon /app/dashboard: $(/usr/bin/curl -s -o /dev/null -w 'code=%{http_code} loc=%{redirect_url}\n' http://localhost:3000/app/dashboard)"
echo "Anon /app/w/foo/dashboard: $(/usr/bin/curl -s -o /dev/null -w 'code=%{http_code} loc=%{redirect_url}\n' http://localhost:3000/app/w/foo/dashboard)"
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
```
Both should redirect to `/log-in?redirect=...`.

- [ ] **Step 5: Commit + push**

```bash
git add -A && git commit -m "feat(proxy): membership check, recent cookie, back-compat redirects" && git push
```

---

## Task 9: Personal app layout — `src/app/app/layout.tsx`

**Files:**
- Modify: `src/app/app/layout.tsx` (no longer fetches workspace; delegates workspace chrome to `[slug]/layout`)
- Modify: `src/app/app/page.tsx` (new redirect logic to `/app/w/<recent>/dashboard`)

- [ ] **Step 1: Read both current files**

```bash
cat src/app/app/layout.tsx src/app/app/page.tsx
```

- [ ] **Step 2: Rewrite `src/app/app/layout.tsx`** (personal-only chrome — header with workspace switcher + user menu; no sidebar)

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { UserMenu } from '@/components/app/user-menu'
import { WorkspaceSwitcher } from '@/components/app/workspace-switcher'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/log-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userData.user.id)
    .single()

  // Fetch all workspaces for the switcher
  const { data: rows } = await supabase
    .from('workspace_members')
    .select('workspaces!inner(id, name, slug)')
    .eq('user_id', userData.user.id)
  const workspaces = (rows ?? [])
    .map((r) => (Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces))
    .filter((w): w is { id: string; name: string; slug: string } => Boolean(w))

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-card px-6">
        <WorkspaceSwitcher workspaces={workspaces} activeSlug={null} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu
            email={userData.user.email ?? ''}
            displayName={profile?.display_name ?? null}
            avatarUrl={profile?.avatar_url ?? null}
          />
        </div>
      </header>
      <main className="flex-1 overflow-auto bg-muted/20 p-8">{children}</main>
    </div>
  )
}
```

> Note: `WorkspaceSwitcher` is built in Task 12. This task assumes it exists and accepts `workspaces` + `activeSlug` props. Until Task 12 lands, the build will fail at this import. **Implement Task 12 right after Task 9 (or batch them in one commit if you want to keep the build green at every commit).** For TDD-friendly stepping, you can stub the WorkspaceSwitcher first (just renders the active workspace name) and elaborate in Task 12.

- [ ] **Step 3: Rewrite `src/app/app/page.tsx`**

```tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AppIndex() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/log-in')

  const { data: rows } = await supabase
    .from('workspace_members')
    .select('joined_at, workspaces!inner(slug)')
    .eq('user_id', userData.user.id)
    .order('joined_at', { ascending: false })

  const slugs = (rows ?? [])
    .map((r) => (Array.isArray(r.workspaces) ? r.workspaces[0]?.slug : r.workspaces?.slug))
    .filter((s): s is string => Boolean(s))

  if (slugs.length === 0) redirect('/onboarding')

  const cookieSlug = (await cookies()).get('recent_workspace_slug')?.value
  const target = cookieSlug && slugs.includes(cookieSlug) ? cookieSlug : slugs[0]

  redirect(`/app/w/${target}/dashboard`)
}
```

- [ ] **Step 4: Stub `src/components/app/workspace-switcher.tsx`** (so the build compiles before Task 12)

`src/components/app/workspace-switcher.tsx`:
```tsx
'use client'

interface WorkspaceSummary {
  id: string
  name: string
  slug: string
}

export function WorkspaceSwitcher({
  workspaces,
  activeSlug,
}: {
  workspaces: WorkspaceSummary[]
  activeSlug: string | null
}) {
  const active = activeSlug ? workspaces.find((w) => w.slug === activeSlug) : null
  return (
    <div className="text-sm font-medium">
      {active?.name ?? 'Personal'}
    </div>
  )
}
```

- [ ] **Step 5: Quality gates + smoke test**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
lsof -ti:3000 | xargs kill -9 2>/dev/null
pnpm dev > /tmp/autoads-task9.log 2>&1 &
sleep 12
echo "Anon /: $(/usr/bin/curl -s -o /dev/null -w 'code=%{http_code}\n' http://localhost:3000/)"
echo "Anon /app: $(/usr/bin/curl -s -o /dev/null -w 'code=%{http_code} loc=%{redirect_url}\n' http://localhost:3000/app)"
kill %1; wait %1 2>/dev/null
```

- [ ] **Step 6: Commit + push**

```bash
git add -A && git commit -m "feat(app): personal app layout (header only) + new /app redirect logic + WorkspaceSwitcher stub" && git push
```

---

## Task 10: Workspace `[slug]` layout + move 5 protected pages

**Files:**
- Create: `src/app/app/w/[slug]/layout.tsx`
- Create: `src/app/app/w/[slug]/page.tsx` (redirect to /dashboard)
- Move: `src/app/app/dashboard/` → `src/app/app/w/[slug]/dashboard/`
- Move: `src/app/app/campaigns/` → `src/app/app/w/[slug]/campaigns/`
- Move: `src/app/app/connections/` → `src/app/app/w/[slug]/connections/`
- Move: `src/app/app/automation/` → `src/app/app/w/[slug]/automation/`
- Move: `src/app/app/reports/` → `src/app/app/w/[slug]/reports/`

- [ ] **Step 1: Move the 5 page directories**

```bash
mkdir -p src/app/app/w/\[slug\]
git mv src/app/app/dashboard src/app/app/w/\[slug\]/dashboard
git mv src/app/app/campaigns src/app/app/w/\[slug\]/campaigns
git mv src/app/app/connections src/app/app/w/\[slug\]/connections
git mv src/app/app/automation src/app/app/w/\[slug\]/automation
git mv src/app/app/reports src/app/app/w/\[slug\]/reports
```

- [ ] **Step 2: Update each moved page to update its in-page links**

The dashboard page has a `Link href="/app/connections"`. Update it to use the slug. Read each moved page and update any internal `/app/...` links to `/app/w/${slug}/...` style.

For the dashboard, since it's a server component receiving `params`, the simplest pattern:

`src/app/app/w/[slug]/dashboard/page.tsx`:
```tsx
import { Plug } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview · Last 7 days</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Spend" value="—" />
        <StatCard label="Clicks" value="—" />
        <StatCard label="Conversions" value="—" />
        <StatCard label="ROAS" value="—" />
      </div>
      <EmptyState
        icon={Plug}
        title="No connected accounts yet"
        description="Connect your Google Ads or Meta Ads account to see live performance data here."
        action={
          <Button render={<Link href={`/app/w/${slug}/connections`} />}>Connect an account</Button>
        }
      />
    </div>
  )
}
```

The other 4 stub pages have no internal links — they'll work as-is, but read each to confirm. If they don't accept `params`, they don't need changes.

- [ ] **Step 3: Create `src/app/app/w/[slug]/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

export default async function WorkspaceIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/app/w/${slug}/dashboard`)
}
```

- [ ] **Step 4: Create `src/app/app/w/[slug]/layout.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireMember } from '@/lib/auth/membership'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { UserMenu } from '@/components/app/user-menu'
import { WorkspaceSwitcher } from '@/components/app/workspace-switcher'
import { AppSidebar } from '@/components/app/app-sidebar'

export default async function WorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}) {
  const { slug } = await params
  const m = await requireMember(slug)

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userData.user.id)
    .single()

  const { data: rows } = await supabase
    .from('workspace_members')
    .select('workspaces!inner(id, name, slug)')
    .eq('user_id', userData.user.id)
  const workspaces = (rows ?? [])
    .map((r) => (Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces))
    .filter((w): w is { id: string; name: string; slug: string } => Boolean(w))

  return (
    <div className="flex h-dvh">
      <AppSidebar workspaceSlug={slug} workspaceName={m.workspaceName} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-6">
          <WorkspaceSwitcher workspaces={workspaces} activeSlug={slug} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu
              email={userData.user.email ?? ''}
              displayName={profile?.display_name ?? null}
              avatarUrl={profile?.avatar_url ?? null}
            />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-muted/20 p-8">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update `AppSidebar` to take `workspaceSlug` and prefix nav links**

Read `src/components/app/app-sidebar.tsx`. The Foundation version had hardcoded `/app/dashboard` etc. links. Replace with slug-aware links:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Megaphone, Plug, Cog, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/shared/logo'

export function AppSidebar({
  workspaceSlug,
  workspaceName,
}: {
  workspaceSlug: string
  workspaceName: string
}) {
  const pathname = usePathname()
  const NAV = [
    { href: `/app/w/${workspaceSlug}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/app/w/${workspaceSlug}/campaigns`, label: 'Campaigns', icon: Megaphone },
    { href: `/app/w/${workspaceSlug}/connections`, label: 'Connections', icon: Plug },
    { href: `/app/w/${workspaceSlug}/automation`, label: 'Automation', icon: Cog },
    { href: `/app/w/${workspaceSlug}/reports`, label: 'Reports', icon: BarChart3 },
    { href: `/app/w/${workspaceSlug}/settings/general`, label: 'Settings', icon: Settings },
  ]
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card">
      <div className="px-5 py-4">
        <Logo href={`/app/w/${workspaceSlug}/dashboard`} />
        <p className="text-muted-foreground mt-1 text-xs">{workspaceName}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 6: Quality gates + smoke test**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

The build will likely flag the OLD `src/app/app/layout.tsx` that may still try to render workspace chrome. Verify it now matches the personal-context shape from Task 9 (no sidebar, no workspace fetching).

- [ ] **Step 7: Commit + push**

```bash
git add -A && git commit -m "feat(app): introduce /app/w/[slug]/ scope; move 5 protected pages + workspace layout + sidebar" && git push
```

---

## Task 11: Move workspace settings; add settings layout for `[slug]/settings/*`

**Files:**
- Move: `src/app/app/settings/workspace/page.tsx` → `src/app/app/w/[slug]/settings/general/page.tsx` (rename folder + file content edit)
- Create: `src/app/app/w/[slug]/settings/layout.tsx`
- Delete: `src/app/app/settings/workspace/` (after move)

- [ ] **Step 1: Move and rename**

```bash
mkdir -p src/app/app/w/\[slug\]/settings
git mv src/app/app/settings/workspace src/app/app/w/\[slug\]/settings/general
```

- [ ] **Step 2: Update the moved page to use slug**

`src/app/app/w/[slug]/settings/general/page.tsx`:
```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/membership'
import { updateWorkspace } from '@/lib/actions/workspace'

export default async function WorkspaceGeneralSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await requireRole(slug, ['owner', 'admin'])

  const supabase = await createClient()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, slug')
    .eq('slug', slug)
    .single()

  const action = async (formData: FormData) => {
    'use server'
    await updateWorkspace(slug, formData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input id="name" name="name" defaultValue={workspace?.name ?? ''} maxLength={60} required />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={workspace?.slug ?? ''} disabled />
            <p className="text-muted-foreground text-xs">
              Slug is generated from the name and cannot be changed.
            </p>
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create the workspace-settings layout (sub-nav)**

`src/app/app/w/[slug]/settings/layout.tsx`:
```tsx
import Link from 'next/link'
import { requireMember } from '@/lib/auth/membership'

export default async function WorkspaceSettingsLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}) {
  const { slug } = await params
  const m = await requireMember(slug)

  const tabs = [
    { href: `/app/w/${slug}/settings/general`, label: 'General' },
    { href: `/app/w/${slug}/settings/members`, label: 'Members' },
    ...(m.role === 'owner' ? [{ href: `/app/w/${slug}/settings/danger`, label: 'Danger zone' }] : []),
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Workspace settings</h1>
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Update Foundation `src/app/app/settings/layout.tsx`** to remove the now-deleted Workspace tab

Read `src/app/app/settings/layout.tsx`. The Foundation version had three tabs: Profile / Workspace / Account. Workspace is gone. Update to:

```tsx
import Link from 'next/link'

const TABS = [
  { href: '/app/settings/profile', label: 'Profile' },
  { href: '/app/settings/account', label: 'Account' },
] as const

export default function PersonalSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Personal settings</h1>
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Update Foundation spec to mark `/app/settings/workspace` as moved**

`docs/superpowers/specs/2026-04-22-foundation-design.md` Section 2 route map — find `/app/settings/workspace` and add a note: `(moved to /app/w/<slug>/settings/general in sub-project 2)`.

- [ ] **Step 6: Quality gates**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 7: Commit + push**

```bash
git add -A && git commit -m "feat(settings): move workspace settings to /app/w/[slug]/settings/general + workspace settings sub-nav" && git push
```

---

## Task 12: WorkspaceSwitcher + CreateWorkspaceDialog

**Files:**
- Modify: `src/components/app/workspace-switcher.tsx` (replace Task 9 stub with real switcher)
- Create: `src/components/app/create-workspace-dialog.tsx`

- [ ] **Step 1: Replace `WorkspaceSwitcher` stub**

`src/components/app/workspace-switcher.tsx`:
```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { CreateWorkspaceDialog } from './create-workspace-dialog'

interface WorkspaceSummary {
  id: string
  name: string
  slug: string
}

export function WorkspaceSwitcher({
  workspaces,
  activeSlug,
}: {
  workspaces: WorkspaceSummary[]
  activeSlug: string | null
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const router = useRouter()
  const active = activeSlug ? workspaces.find((w) => w.slug === activeSlug) : null
  const label = active?.name ?? 'Personal'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 gap-2 px-2 text-sm font-medium"
            >
              {label}
              <ChevronsUpDown className="h-4 w-4 opacity-60" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <div className="text-muted-foreground px-1.5 py-1 text-xs font-medium">Workspaces</div>
          {workspaces.slice(0, 8).map((w) => (
            <DropdownMenuItem
              key={w.id}
              onClick={() => router.push(`/app/w/${w.slug}/dashboard`)}
              className="justify-between"
            >
              <span className="truncate">{w.name}</span>
              {w.slug === activeSlug ? <Check className="h-4 w-4 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New workspace
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/app" />}>View all workspaces</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
```

- [ ] **Step 2: Create `CreateWorkspaceDialog`**

`src/components/app/create-workspace-dialog.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createWorkspace } from '@/lib/actions/workspaces'

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const result = await createWorkspace(formData)
      if (result && 'error' in result && result.error) setError(result.error)
      // Success path: createWorkspace redirects, so this branch never runs.
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input id="name" name="name" type="text" maxLength={60} required autoFocus />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Creating…' : 'Create workspace'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Quality gates + smoke**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
lsof -ti:3000 | xargs kill -9 2>/dev/null
pnpm dev > /tmp/autoads-task12.log 2>&1 &
sleep 12
echo "Anon /: $(/usr/bin/curl -s -o /dev/null -w 'code=%{http_code}\n' http://localhost:3000/)"
kill %1 2>/dev/null; wait %1 2>/dev/null
```

- [ ] **Step 4: Commit + push**

```bash
git add -A && git commit -m "feat(app): real WorkspaceSwitcher + CreateWorkspaceDialog" && git push
```

---

## Task 13: Members table — `WorkspaceMembersTable` + `RoleSelect` + `RemoveMemberButton`

**Files:**
- Create: `src/components/app/workspace-members-table.tsx`
- Create: `src/components/app/role-select.tsx`
- Create: `src/components/app/remove-member-button.tsx`
- Create: `src/app/app/w/[slug]/settings/members/page.tsx` (data-fetching server component; UI in pieces)

- [ ] **Step 1: Create the `RoleSelect` client component**

`src/components/app/role-select.tsx`:
```tsx
'use client'

import { useTransition, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { changeMemberRole, transferOwnership } from '@/lib/actions/workspaces'
import { toast } from 'sonner'

export function RoleSelect({
  slug,
  userId,
  currentRole,
  callerRole,
  isCurrentUserOwner,
  isThisRowTheOwner,
}: {
  slug: string
  userId: string
  currentRole: 'owner' | 'admin' | 'member'
  callerRole: 'owner' | 'admin' | 'member'
  isCurrentUserOwner: boolean
  isThisRowTheOwner: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState<string>(currentRole)

  // Disable the select for non-admins, and disable changing the owner row.
  const disabled = callerRole === 'member' || isThisRowTheOwner

  const onChange = (next: string) => {
    if (next === value) return
    setValue(next)
    startTransition(async () => {
      let result
      if (next === 'owner') {
        result = await transferOwnership(slug, userId)
      } else {
        result = await changeMemberRole(slug, userId, next as 'admin' | 'member')
      }
      if (result && 'error' in result && result.error) {
        toast.error(result.error)
        setValue(currentRole)
      } else {
        toast.success('Role updated')
      }
    })
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isPending}>
      <SelectTrigger className="h-8 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {/* Only owner can promote to owner */}
        {isCurrentUserOwner && <SelectItem value="owner">Owner</SelectItem>}
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 2: Create the `RemoveMemberButton` client component**

`src/components/app/remove-member-button.tsx`:
```tsx
'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { removeMember } from '@/lib/actions/workspaces'
import { toast } from 'sonner'

export function RemoveMemberButton({
  slug,
  userId,
  memberLabel,
}: {
  slug: string
  userId: string
  memberLabel: string
}) {
  const [isPending, startTransition] = useTransition()
  const onClick = () => {
    if (!confirm(`Remove ${memberLabel} from this workspace?`)) return
    startTransition(async () => {
      const result = await removeMember(slug, userId)
      if (result && 'error' in result && result.error) toast.error(result.error)
      else toast.success(`Removed ${memberLabel}`)
    })
  }
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={onClick}>
      {isPending ? 'Removing…' : 'Remove'}
    </Button>
  )
}
```

- [ ] **Step 3: Create `WorkspaceMembersTable` (server component, takes pre-fetched data)**

`src/components/app/workspace-members-table.tsx`:
```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RoleSelect } from './role-select'
import { RemoveMemberButton } from './remove-member-button'

export interface MemberRow {
  userId: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: 'owner' | 'admin' | 'member'
}

export function WorkspaceMembersTable({
  slug,
  members,
  callerUserId,
  callerRole,
}: {
  slug: string
  members: MemberRow[]
  callerUserId: string
  callerRole: 'owner' | 'admin' | 'member'
}) {
  const isCurrentUserOwner = callerRole === 'owner'
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="w-32 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => {
          const isMe = m.userId === callerUserId
          const isOwnerRow = m.role === 'owner'
          const initial = (m.displayName || m.email).charAt(0).toUpperCase()
          const showRemove = !isOwnerRow && callerRole !== 'member' && !isMe
          return (
            <TableRow key={m.userId}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">
                      {m.displayName || m.email}
                      {isMe && <span className="text-muted-foreground ml-2 text-xs">(you)</span>}
                    </div>
                    {m.displayName && <div className="text-muted-foreground text-xs">{m.email}</div>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <RoleSelect
                  slug={slug}
                  userId={m.userId}
                  currentRole={m.role}
                  callerRole={callerRole}
                  isCurrentUserOwner={isCurrentUserOwner}
                  isThisRowTheOwner={isOwnerRow}
                />
              </TableCell>
              <TableCell className="text-right">
                {showRemove && (
                  <RemoveMemberButton
                    slug={slug}
                    userId={m.userId}
                    memberLabel={m.displayName || m.email}
                  />
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 4: Create the members page** (this fetches data + composes — also ties in Task 14's invite section, so we'll write the page partially here and complete it in Task 14)

`src/app/app/w/[slug]/settings/members/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { requireMember } from '@/lib/auth/membership'
import { WorkspaceMembersTable, type MemberRow } from '@/components/app/workspace-members-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const m = await requireMember(slug)

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const callerUserId = userData.user!.id

  // Fetch members + their profiles
  const { data: rows } = await supabase
    .from('workspace_members')
    .select('user_id, role, profiles!inner(display_name, avatar_url)')
    .eq('workspace_id', m.workspaceId)
    .order('joined_at', { ascending: true })

  // We also need each member's email — query auth via service role isn't available client-side.
  // Workaround: rely on auth.users via a Postgres view or fetch from admin API. For simplicity here
  // we'll use the admin client to list users by id.
  const { createClient: createAdmin } = await import('@supabase/supabase-js')
  const { env } = await import('@/lib/env')
  const admin = createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const userIds = (rows ?? []).map((r) => r.user_id)
  const emails: Record<string, string> = {}
  for (const uid of userIds) {
    const { data } = await admin.auth.admin.getUserById(uid)
    if (data.user?.email) emails[uid] = data.user.email
  }

  const members: MemberRow[] = (rows ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      userId: r.user_id,
      email: emails[r.user_id] ?? '(unknown)',
      displayName: p?.display_name ?? null,
      avatarUrl: p?.avatar_url ?? null,
      role: r.role as MemberRow['role'],
    }
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceMembersTable
            slug={slug}
            members={members}
            callerUserId={callerUserId}
            callerRole={m.role}
          />
        </CardContent>
      </Card>
      {/* InviteSection + PendingInvitationsList added in Task 14 */}
    </div>
  )
}
```

- [ ] **Step 5: Quality gates**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 6: Commit + push**

```bash
git add -A && git commit -m "feat(members): add WorkspaceMembersTable + RoleSelect + RemoveMemberButton + members page (table only)" && git push
```

---

## Task 14: Invite section + pending invitations list (in members page)

**Files:**
- Create: `src/components/app/invite-section.tsx`
- Create: `src/components/app/pending-invitations-list.tsx`
- Modify: `src/app/app/w/[slug]/settings/members/page.tsx` (add the two new components below the members table)

- [ ] **Step 1: Create `InviteSection`**

`src/components/app/invite-section.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteMember } from '@/lib/actions/workspaces'
import { toast } from 'sonner'

export function InviteSection({ slug }: { slug: string }) {
  const [isPending, startTransition] = useTransition()
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (formData: FormData) => {
    setError(null)
    setLink(null)
    startTransition(async () => {
      const result = await inviteMember(slug, formData)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('link' in result && result.link) {
        setLink(result.link)
        toast.success('Invitation sent')
      }
    })
  }

  const copyLink = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    toast.success('Link copied')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a member</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="role" value="member" defaultChecked /> Member
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="role" value="admin" /> Admin
              </label>
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Sending…' : 'Send invite'}
            </Button>
            {link && (
              <>
                <span className="text-muted-foreground text-xs">or copy link:</span>
                <code className="bg-muted truncate rounded px-2 py-1 text-xs">{link}</code>
                <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                  Copy
                </Button>
              </>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create `PendingInvitationsList`**

`src/components/app/pending-invitations-list.tsx`:
```tsx
'use client'

import { useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { revokeInvitation } from '@/lib/actions/workspaces'
import { toast } from 'sonner'

export interface PendingInvitation {
  id: string
  email: string
  role: 'admin' | 'member'
  createdAt: string
}

export function PendingInvitationsList({
  slug,
  invitations,
  canRevoke,
}: {
  slug: string
  invitations: PendingInvitation[]
  canRevoke: boolean
}) {
  if (invitations.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations ({invitations.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {invitations.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium">{inv.email}</span>
                <span className="text-muted-foreground ml-2">{inv.role}</span>
              </div>
              {canRevoke && <RevokeButton slug={slug} invitationId={inv.id} />}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function RevokeButton({ slug, invitationId }: { slug: string; invitationId: string }) {
  const [isPending, startTransition] = useTransition()
  const onClick = () => {
    if (!confirm('Revoke this invitation?')) return
    startTransition(async () => {
      const result = await revokeInvitation(slug, invitationId)
      if (result && 'error' in result && result.error) toast.error(result.error)
      else toast.success('Invitation revoked')
    })
  }
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={onClick}>
      {isPending ? 'Revoking…' : 'Revoke'}
    </Button>
  )
}
```

- [ ] **Step 3: Update members page to include both sections**

Add to `src/app/app/w/[slug]/settings/members/page.tsx`, after the existing `WorkspaceMembersTable` Card:

```tsx
import { InviteSection } from '@/components/app/invite-section'
import { PendingInvitationsList, type PendingInvitation } from '@/components/app/pending-invitations-list'

// ... inside the component, after fetching members:
const canManage = m.role === 'owner' || m.role === 'admin'
const { data: pendingRows } = await supabase
  .from('invitations')
  .select('id, email, role, created_at')
  .eq('workspace_id', m.workspaceId)
  .is('accepted_at', null)
  .order('created_at', { ascending: false })

const pending: PendingInvitation[] = (pendingRows ?? []).map((r) => ({
  id: r.id,
  email: r.email,
  role: r.role as 'admin' | 'member',
  createdAt: r.created_at,
}))

// ... in the JSX, after the members Card:
{canManage && <InviteSection slug={slug} />}
<PendingInvitationsList slug={slug} invitations={pending} canRevoke={canManage} />
```

- [ ] **Step 4: Quality gates + commit**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
git add -A && git commit -m "feat(members): add InviteSection + PendingInvitationsList" && git push
```

---

## Task 15: Danger zone — `TransferOwnershipForm` + `DeleteWorkspaceForm`

**Files:**
- Create: `src/components/app/transfer-ownership-form.tsx`
- Create: `src/components/app/delete-workspace-form.tsx`
- Create: `src/app/app/w/[slug]/settings/danger/page.tsx`

- [ ] **Step 1: Create `TransferOwnershipForm`**

`src/components/app/transfer-ownership-form.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { transferOwnership } from '@/lib/actions/workspaces'
import { toast } from 'sonner'

export function TransferOwnershipForm({
  slug,
  candidates,
}: {
  slug: string
  candidates: Array<{ userId: string; label: string; role: 'admin' | 'member' }>
}) {
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<string>('')
  const onClick = () => {
    if (!target) return
    if (!confirm('Transfer ownership? You will become an admin.')) return
    startTransition(async () => {
      const result = await transferOwnership(slug, target)
      if (result && 'error' in result && result.error) toast.error(result.error)
      else toast.success('Ownership transferred')
    })
  }
  if (candidates.length === 0) {
    return <p className="text-muted-foreground text-sm">Invite a member before transferring ownership.</p>
  }
  return (
    <div className="flex items-center gap-2">
      <Select value={target} onValueChange={setTarget}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Pick a member" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((c) => (
            <SelectItem key={c.userId} value={c.userId}>
              {c.label} ({c.role})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={onClick} disabled={isPending || !target}>
        {isPending ? 'Transferring…' : 'Transfer ownership'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `DeleteWorkspaceForm`**

`src/components/app/delete-workspace-form.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteWorkspace } from '@/lib/actions/workspaces'
import { toast } from 'sonner'

export function DeleteWorkspaceForm({
  slug,
  workspaceName,
}: {
  slug: string
  workspaceName: string
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmText, setConfirmText] = useState('')
  const matches = confirmText.trim() === workspaceName

  const onClick = () => {
    if (!matches) return
    startTransition(async () => {
      const result = await deleteWorkspace(slug)
      if (result && 'error' in result && result.error) toast.error(result.error)
      // Success: redirects to /app
    })
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="confirm">Type the workspace name to confirm:</Label>
      <Input
        id="confirm"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={workspaceName}
      />
      <Button variant="destructive" disabled={!matches || isPending} onClick={onClick}>
        {isPending ? 'Deleting…' : 'Delete workspace'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Create the danger zone page**

`src/app/app/w/[slug]/settings/danger/page.tsx`:
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/membership'
import { TransferOwnershipForm } from '@/components/app/transfer-ownership-form'
import { DeleteWorkspaceForm } from '@/components/app/delete-workspace-form'

export default async function DangerZonePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const m = await requireRole(slug, ['owner'])

  const supabase = await createClient()

  // Candidates for transfer: all members other than the current owner
  const { data: rows } = await supabase
    .from('workspace_members')
    .select('user_id, role, profiles!inner(display_name)')
    .eq('workspace_id', m.workspaceId)
    .neq('role', 'owner')

  const { createClient: createAdmin } = await import('@supabase/supabase-js')
  const { env } = await import('@/lib/env')
  const admin = createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const candidates = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data } = await admin.auth.admin.getUserById(r.user_id)
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      const label = p?.display_name || data.user?.email || 'Unknown'
      return { userId: r.user_id, label, role: r.role as 'admin' | 'member' }
    }),
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Transfer ownership</CardTitle>
          <CardDescription>
            After transfer, you will become an admin. The new owner gains all owner-only permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransferOwnershipForm slug={slug} candidates={candidates} />
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete workspace</CardTitle>
          <CardDescription>
            Permanently delete &quot;{m.workspaceName}&quot; and all its data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteWorkspaceForm slug={slug} workspaceName={m.workspaceName} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Quality gates + commit**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
git add -A && git commit -m "feat(danger): add danger zone page with transfer + delete forms" && git push
```

---

## Task 16: Public `/invite/[token]` landing + `InviteAcceptCard`

**Files:**
- Create: `src/components/app/invite-accept-card.tsx`
- Create: `src/app/invite/[token]/page.tsx`

- [ ] **Step 1: Create `InviteAcceptCard`**

`src/components/app/invite-accept-card.tsx`:
```tsx
'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/shared/logo'
import { acceptInvitation, declineInvitation } from '@/lib/actions/workspaces'
import { logOut } from '@/lib/actions/auth'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export type InviteState =
  | { kind: 'invalid'; message: string }
  | {
      kind: 'signedIn'
      workspaceName: string
      role: 'admin' | 'member'
      inviterEmail: string
      token: string
      invitationId: string
    }
  | {
      kind: 'wrongAccount'
      workspaceName: string
      inviteEmail: string
      callerEmail: string
    }
  | {
      kind: 'anonymous'
      workspaceName: string
      role: 'admin' | 'member'
      inviterEmail: string
      token: string
      inviteEmail: string
    }

export function InviteAcceptCard({ state }: { state: InviteState }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <Logo className="mb-8" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {state.kind === 'invalid' ? 'Invitation unavailable' : 'You have been invited'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === 'invalid' && <p className="text-sm">{state.message}</p>}

          {state.kind === 'signedIn' && (
            <SignedInBranch
              workspaceName={state.workspaceName}
              role={state.role}
              inviterEmail={state.inviterEmail}
              token={state.token}
              invitationId={state.invitationId}
            />
          )}

          {state.kind === 'wrongAccount' && (
            <WrongAccountBranch
              workspaceName={state.workspaceName}
              inviteEmail={state.inviteEmail}
              callerEmail={state.callerEmail}
            />
          )}

          {state.kind === 'anonymous' && (
            <AnonymousBranch
              workspaceName={state.workspaceName}
              role={state.role}
              inviterEmail={state.inviterEmail}
              token={state.token}
              inviteEmail={state.inviteEmail}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SignedInBranch({
  workspaceName,
  role,
  inviterEmail,
  token,
  invitationId,
}: {
  workspaceName: string
  role: string
  inviterEmail: string
  token: string
  invitationId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const onAccept = () =>
    startTransition(async () => {
      const result = await acceptInvitation(token)
      if ('error' in result && result.error) toast.error(result.error)
      else if ('slug' in result) router.push(`/app/w/${result.slug}/dashboard`)
    })
  const onDecline = () =>
    startTransition(async () => {
      await declineInvitation(invitationId)
      router.push('/app')
    })
  return (
    <>
      <p className="text-sm">
        Join <strong>{workspaceName}</strong> as a <strong>{role}</strong>.
      </p>
      <p className="text-muted-foreground text-xs">Invited by {inviterEmail}</p>
      <div className="flex gap-2 pt-2">
        <Button onClick={onAccept} disabled={isPending}>
          {isPending ? 'Accepting…' : 'Accept invitation'}
        </Button>
        <Button variant="ghost" onClick={onDecline} disabled={isPending}>
          Decline
        </Button>
      </div>
    </>
  )
}

function WrongAccountBranch({
  workspaceName,
  inviteEmail,
  callerEmail,
}: {
  workspaceName: string
  inviteEmail: string
  callerEmail: string
}) {
  const onSignOut = () => {
    const form = document.createElement('form')
    form.action = ''
    form.method = 'POST'
    // Easier: just redirect to a server action route via a real form submit.
    // For simplicity, navigate to a route that does the sign-out.
  }
  return (
    <>
      <p className="text-sm">
        This invitation to join <strong>{workspaceName}</strong> was sent to{' '}
        <strong>{inviteEmail}</strong>. You are signed in as <strong>{callerEmail}</strong>.
      </p>
      <form action={logOut}>
        <Button type="submit" variant="outline">Sign out and switch accounts</Button>
      </form>
    </>
  )
}

function AnonymousBranch({
  workspaceName,
  role,
  inviterEmail,
  token,
  inviteEmail,
}: {
  workspaceName: string
  role: string
  inviterEmail: string
  token: string
  inviteEmail: string
}) {
  const signUpHref = `/sign-up?invite_token=${encodeURIComponent(token)}&email=${encodeURIComponent(inviteEmail)}`
  const logInHref = `/log-in?invite_token=${encodeURIComponent(token)}`
  return (
    <>
      <p className="text-sm">
        Join <strong>{workspaceName}</strong> as a <strong>{role}</strong>.
      </p>
      <p className="text-muted-foreground text-xs">Invited by {inviterEmail}</p>
      <div className="flex flex-col gap-2 pt-2">
        <Button render={<Link href={signUpHref} />}>Sign up to accept</Button>
        <Button variant="outline" render={<Link href={logInHref} />}>
          I have an account
        </Button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Create the public landing page**

`src/app/invite/[token]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { InviteAcceptCard, type InviteState } from '@/components/app/invite-accept-card'

export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Re-encode the URL-safe token back to base64 if needed for lookup
  const dbToken = token.replace(/-/g, '+').replace(/_/g, '/')

  const { data: invite } = await admin
    .from('invitations')
    .select(
      'id, email, role, expires_at, accepted_at, invited_by, workspaces!inner(slug, name)',
    )
    .eq('token', dbToken)
    .maybeSingle()

  let state: InviteState
  if (!invite) {
    state = { kind: 'invalid', message: 'This invitation does not exist or has already been accepted.' }
  } else if (invite.accepted_at) {
    state = { kind: 'invalid', message: 'This invitation has already been accepted.' }
  } else if (new Date(invite.expires_at).getTime() < Date.now()) {
    state = { kind: 'invalid', message: 'This invitation has expired.' }
  } else {
    const ws = Array.isArray(invite.workspaces) ? invite.workspaces[0] : invite.workspaces
    if (!ws) {
      state = { kind: 'invalid', message: 'Workspace not found.' }
    } else {
      const supabase = await createClient()
      const { data: userData } = await supabase.auth.getUser()

      // Inviter email lookup
      let inviterEmail = 'unknown'
      if (invite.invited_by) {
        const { data: inviter } = await admin.auth.admin.getUserById(invite.invited_by)
        inviterEmail = inviter.user?.email ?? 'unknown'
      }

      if (!userData.user) {
        state = {
          kind: 'anonymous',
          workspaceName: ws.name,
          role: invite.role as 'admin' | 'member',
          inviterEmail,
          token,
          inviteEmail: invite.email,
        }
      } else if ((userData.user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
        state = {
          kind: 'wrongAccount',
          workspaceName: ws.name,
          inviteEmail: invite.email,
          callerEmail: userData.user.email ?? '',
        }
      } else {
        state = {
          kind: 'signedIn',
          workspaceName: ws.name,
          role: invite.role as 'admin' | 'member',
          inviterEmail,
          token,
          invitationId: invite.id,
        }
      }
    }
  }

  return <InviteAcceptCard state={state} />
}
```

- [ ] **Step 3: Update proxy matcher to allow `/invite/[token]` to be public**

The proxy currently matches everything except api/health and static assets. The matcher itself doesn't exclude `/invite/...` — it's a public page that doesn't need to be protected. But the proxy's logic as written will redirect anonymous users to /log-in if the path matches a PROTECTED prefix. `/invite` isn't in PROTECTED_PREFIXES so it should pass through anonymously. Verify by reading `src/proxy.ts` and confirming.

- [ ] **Step 4: Quality gates + commit**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
git add -A && git commit -m "feat(invite): public /invite/[token] landing with 4 branches (invalid/signedIn/wrongAccount/anonymous)" && git push
```

---

## Task 17: `/app/invitations` page + pending-invites banner

**Files:**
- Create: `src/app/app/invitations/page.tsx`
- Create: `src/components/app/pending-invites-banner.tsx`
- Modify: `src/app/app/layout.tsx` (mount the banner)

- [ ] **Step 1: Create the invitations page**

`src/app/app/invitations/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AcceptDeclineRow } from '@/components/app/pending-invitations-list'

export default async function InvitationsPage() {
  // Note: AcceptDeclineRow is imported below; we'll add it inline since this is a one-off page row.
  return null
}
```

That's a stub — we need a per-row accept/decline. Let me write it more carefully. **Replace the above with:**

`src/app/app/invitations/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { InvitationActionRow } from '@/components/app/invitation-action-row'

export default async function InvitationsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/log-in')

  const callerEmail = (userData.user.email ?? '').toLowerCase()

  const { data: rows } = await supabase
    .from('invitations')
    .select('id, role, token, workspaces!inner(name, slug)')
    .eq('email', callerEmail)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  const invites = (rows ?? []).map((r) => {
    const w = Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces
    return { id: r.id, role: r.role as 'admin' | 'member', token: r.token, workspaceName: w?.name ?? '?' }
  })

  if (invites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState icon={Mail} title="You're all caught up." description="No pending invitations." />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations ({invites.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {invites.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-3">
              <div>
                <span className="font-medium">{i.workspaceName}</span>
                <span className="text-muted-foreground ml-2 text-xs">{i.role}</span>
              </div>
              <InvitationActionRow id={i.id} token={i.token} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create `InvitationActionRow` (accept/decline buttons)**

`src/components/app/invitation-action-row.tsx`:
```tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { acceptInvitation, declineInvitation } from '@/lib/actions/workspaces'
import { toast } from 'sonner'

// Re-encode DB token to URL-safe form for accept (acceptInvitation accepts either; we pass the URL form for symmetry)
function urlSafe(t: string) {
  return t.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function InvitationActionRow({ id, token }: { id: string; token: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const onAccept = () =>
    startTransition(async () => {
      const result = await acceptInvitation(urlSafe(token))
      if ('error' in result && result.error) toast.error(result.error)
      else if ('slug' in result) router.push(`/app/w/${result.slug}/dashboard`)
    })
  const onDecline = () =>
    startTransition(async () => {
      await declineInvitation(id)
      router.refresh()
    })
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={onAccept} disabled={isPending}>
        {isPending ? '…' : 'Accept'}
      </Button>
      <Button variant="ghost" size="sm" onClick={onDecline} disabled={isPending}>
        Decline
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Create `PendingInvitesBanner` (server component)**

`src/components/app/pending-invites-banner.tsx`:
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export async function PendingInvitesBanner() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user?.email) return null
  const { count } = await supabase
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('email', userData.user.email.toLowerCase())
    .is('accepted_at', null)
  if ((count ?? 0) === 0) return null
  return (
    <div className="border-b bg-yellow-100 px-6 py-2 text-sm text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100">
      You have {count} pending invitation{count === 1 ? '' : 's'}.{' '}
      <Link href="/app/invitations" className="font-medium underline">
        View →
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Mount the banner in `src/app/app/layout.tsx`**

Add inside the personal layout, between `<header>` and `<main>`:

```tsx
import { PendingInvitesBanner } from '@/components/app/pending-invites-banner'
// ...
<PendingInvitesBanner />
```

(For the workspace layout, mount it similarly — the banner shows everywhere a logged-in user is in the app.)

- [ ] **Step 5: Quality gates + commit**

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
git add -A && git commit -m "feat(invitations): add /app/invitations page + InvitationActionRow + PendingInvitesBanner" && git push
```

---

## Task 18: Playwright E2E — workspace switching

**Files:**
- Create: `tests/e2e/workspaces.spec.ts`

- [ ] **Step 1: Write the test**

`tests/e2e/workspaces.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

test('create + switch between workspaces', async ({ page }) => {
  const email = `test-${Date.now()}@autoads-qa.dev`
  const password = 'Testing123'
  const ws1 = `One ${Date.now()}`
  const ws2 = `Two ${Date.now()}`
  let createdUserId: string | null = null

  // Sign up
  await page.goto('/sign-up')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await Promise.all([page.waitForURL('**/onboarding'), page.click('button[type="submit"]')])

  // Onboard with first workspace
  await page.fill('input[name="name"]', ws1)
  await Promise.all([page.waitForURL(/\/app\/w\/[^/]+\/dashboard/), page.click('button[type="submit"]')])
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText(ws1).first()).toBeVisible()

  const ws1Url = page.url()

  // Open switcher and create second workspace
  await page.getByRole('button', { name: ws1 }).click()
  await page.getByRole('menuitem', { name: /new workspace/i }).click()
  await page.fill('input[name="name"]', ws2)
  await Promise.all([page.waitForURL(/\/app\/w\/[^/]+\/dashboard/), page.click('button[type="submit"]:has-text("Create workspace")')])
  await expect(page.getByText(ws2).first()).toBeVisible()
  expect(page.url()).not.toBe(ws1Url)

  // Switch back to ws1 via switcher
  await page.getByRole('button', { name: ws2 }).click()
  await page.getByRole('menuitem', { name: ws1 }).click()
  await page.waitForURL(ws1Url)
  await expect(page.getByText(ws1).first()).toBeVisible()

  // Cleanup
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: users } = await admin.auth.admin.listUsers()
  const u = users?.users.find((x) => x.email === email)
  if (u) {
    createdUserId = u.id
    await admin.auth.admin.deleteUser(u.id) // cascade removes both workspaces
  }
  expect(createdUserId).not.toBeNull()
})
```

- [ ] **Step 2: Run**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && set -a && source .env.local && set +a && pnpm exec playwright test tests/e2e/workspaces.spec.ts 2>&1 | tail -10
```
Expected: 1 test passes.

- [ ] **Step 3: Commit + push**

```bash
git add -A && git commit -m "test(e2e): workspace switching happy path" && git push
```

---

## Task 19: Playwright E2E — invite flow

**Files:**
- Create: `tests/e2e/invite.spec.ts`

- [ ] **Step 1: Write the test**

`tests/e2e/invite.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

test('owner invites member; member signs up via invite and lands on workspace', async ({ browser }) => {
  const adminEmail = `admin-${Date.now()}@autoads-qa.dev`
  const memberEmail = `member-${Date.now()}@autoads-qa.dev`
  const password = 'Testing123'
  const wsName = `WS ${Date.now()}`
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Owner: sign up + create workspace + send invite ──
  const ownerCtx = await browser.newContext()
  const ownerPage = await ownerCtx.newPage()
  await ownerPage.goto('/sign-up')
  await ownerPage.fill('input[name="email"]', adminEmail)
  await ownerPage.fill('input[name="password"]', password)
  await Promise.all([ownerPage.waitForURL('**/onboarding'), ownerPage.click('button[type="submit"]')])
  await ownerPage.fill('input[name="name"]', wsName)
  await Promise.all([
    ownerPage.waitForURL(/\/app\/w\/[^/]+\/dashboard/),
    ownerPage.click('button[type="submit"]'),
  ])

  // Navigate to members
  const slugMatch = ownerPage.url().match(/\/app\/w\/([^/]+)\//)
  const slug = slugMatch![1]!
  await ownerPage.goto(`/app/w/${slug}/settings/members`)

  // Send invite
  await ownerPage.fill('input[name="email"]', memberEmail)
  await ownerPage.click('button:has-text("Send invite")')

  // Pull invite token from DB
  await ownerPage.waitForTimeout(2000)
  const { data: inv } = await supabaseAdmin
    .from('invitations')
    .select('token')
    .eq('email', memberEmail.toLowerCase())
    .is('accepted_at', null)
    .single()
  const dbToken = inv!.token as string
  const urlToken = dbToken.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

  // ── Member: open invite link in fresh browser, sign up, accept ──
  const memberCtx = await browser.newContext()
  const memberPage = await memberCtx.newPage()
  await memberPage.goto(`/invite/${urlToken}`)
  await expect(memberPage.getByText(wsName)).toBeVisible()
  await memberPage.click('a:has-text("Sign up to accept")')
  await memberPage.waitForURL(/\/sign-up/)
  await memberPage.fill('input[name="email"]', memberEmail)
  await memberPage.fill('input[name="password"]', password)
  await Promise.all([
    memberPage.waitForURL(/\/app\/w\/[^/]+\/dashboard/),
    memberPage.click('button[type="submit"]'),
  ])
  await expect(memberPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(memberPage.getByText(wsName).first()).toBeVisible()

  // ── Cleanup both users ──
  const { data: users } = await supabaseAdmin.auth.admin.listUsers()
  for (const u of users?.users ?? []) {
    if (u.email === adminEmail || u.email === memberEmail) {
      await supabaseAdmin.auth.admin.deleteUser(u.id)
    }
  }

  await ownerCtx.close()
  await memberCtx.close()
})
```

- [ ] **Step 2: Run**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && set -a && source .env.local && set +a && pnpm exec playwright test tests/e2e/invite.spec.ts 2>&1 | tail -15
```
If you hit Supabase email rate-limit (`over_email_send_rate_limit`), wait an hour and retry. The test sends 2 sign-up emails per run.

- [ ] **Step 3: Commit + push**

```bash
git add -A && git commit -m "test(e2e): invite-and-accept happy path" && git push
```

---

## Task 20: Final verification + acceptance walkthrough

**Files:** none

- [ ] **Step 1: Run all gates locally**

```bash
export PATH="/Users/marios/.nvm/versions/node/v20.20.2/bin:/Users/marios/bin:$PATH" && cd /Users/marios/Desktop/Cursor/autoads && pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 2: Run all Playwright E2E (4 tests total: marketing, auth, workspaces, invite)**

```bash
set -a && source .env.local && set +a && pnpm exec playwright test 2>&1 | tail -15
```
Expected: 4/4 pass.

- [ ] **Step 3: Verify deploy succeeded**

```bash
until /usr/bin/curl -s https://autoads-seven.vercel.app/api/health | grep -q '"status":"ok"'; do sleep 8; done && /usr/bin/curl -s https://autoads-seven.vercel.app/api/health
```

Visit `https://autoads-seven.vercel.app/api/health` — expect 200 + ok JSON.

- [ ] **Step 4: Acceptance criteria walkthrough (manual, in your browser)**

Visit production. Sign up with a fresh email (auto-confirm should still be enabled from earlier). Walk through each acceptance criterion from the spec:

- [ ] Land on `/`, sign up, name workspace → `/app/w/<slug>/dashboard`
- [ ] Open switcher, create second workspace → switch between
- [ ] Visit `/app/w/<slug>/settings/members` → see members table with you as owner
- [ ] Invite a teammate by email → email arrives → fresh browser opens link → signs up → lands on dashboard
- [ ] Owner copies the link from members page; pasting in a fresh browser also works
- [ ] Change a member's role between admin/member; verify it persists
- [ ] Transfer ownership to a member; verify new owner has danger-zone access; old owner becomes admin
- [ ] Delete a workspace from danger zone; verify cascade
- [ ] Member leaves a workspace from a (TODO: leave-workspace UI not in this plan — defer to a small follow-up; the action exists in workspaces.ts but no UI)
- [ ] Try to delete account while owning a multi-member workspace → see inline error
- [ ] After transferring ownership, delete account → succeeds

> **Known gap:** No UI button for "Leave workspace" — the `leaveWorkspace` Server Action exists but isn't surfaced. Add to the members table as a self-action in a quick follow-up commit if needed (acceptance criterion is functional but unreachable via UI).

- [ ] **Step 5: Empty commit marking sub-project 2 done**

```bash
git commit --allow-empty -m "chore: sub-project 2 (Workspaces & RBAC) shipped" && git push
```

---

## Self-Review

**Spec coverage:**

| Spec section | Tasks |
|---|---|
| Section 1 — Data model & RLS | Tasks 1, 2, 3 |
| Section 2 — Routes (URL refactor, layouts, /app redirect, back-compat) | Tasks 8, 9, 10, 11 |
| Section 3 — Auth/proxy/RBAC (membership helper, Server Actions, public invite landing) | Tasks 5, 6, 7, 8, 16 |
| Section 4 — UI (switcher, members, invite section, pending list, danger zone, banner) | Tasks 12, 13, 14, 15, 17 |
| Acceptance — workspaces switching | Task 18 |
| Acceptance — invite + accept | Task 19 |
| Acceptance — manual walkthrough | Task 20 |

**Gaps:**
- "Leave workspace" UI is not built (action exists). Flagged in Task 20.
- Pending invites banner mounted on personal layout (Task 17 step 4). Workspace layout banner mount is mentioned in passing but not in a Step. Implementer should add `<PendingInvitesBanner />` to `src/app/app/w/[slug]/layout.tsx` between the header and main as part of Task 17 Step 4 — covered by the prose but not a separate checkbox. Add if missed.

**Placeholder scan:** No "TBD"/"TODO" in plan steps. Two intentional notes: "no leave-workspace UI" (flagged in Task 20) and "ws layout banner mount" (covered in prose but worth re-checking).

**Type consistency:**
- `WorkspaceRole = 'owner' | 'admin' | 'member'` used consistently
- `Membership` interface (`role`, `workspaceId`, `workspaceName`) used by `requireMember` / `requireRole` and consumed by every layout/page
- Cookie name `recent_workspace_slug` used consistently across proxy, actions, and `/app` page
- `acceptInvitation` returns `{ ok: true, slug } | { error }` — consumers check `'slug' in result` (works in TS narrowing)
- `inviteMember` returns `{ ok: true, invitationId, token, link } | { error }`

Plan complete.
