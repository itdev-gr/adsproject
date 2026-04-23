# Sub-Project 2: Workspaces & RBAC — Design Spec

**Date:** 2026-04-23
**Status:** Approved by user, ready for implementation planning
**Effort estimate:** ~1 week solo full-time
**Builds on:** `docs/superpowers/specs/2026-04-22-foundation-design.md`

## Goal

Add multi-tenant workspace support to autoads: a user can belong to many workspaces, each workspace has multiple members with roles (owner / admin / member), invitations are sent by email or shared via link, and every workspace-scoped URL embeds a `<slug>` segment. Replaces Foundation's "one workspace per user" assumption.

## Non-goals

- Per-plan workspace count limits (sub-project 9 — billing)
- Per-plan member count limits (sub-project 9)
- SSO / SAML team management (deferred indefinitely)
- Audit log of who did what in a workspace (deferred — small workspace, hard to surface usefully)
- Workspace-level activity feed (deferred)
- Public read-only "client viewer" role (deferred — owner+admin+member is enough for v1)
- Self-service workspace renaming the slug (slugs stay frozen at creation; the `name` is editable)
- Subdomain routing (`<slug>.autoads.app`) — flat path-segment routing only

---

## Section 1: Data Model & RLS

### What changes vs Foundation

Foundation: `workspaces` with one `owner_id` and a 1-user-per-workspace assumption baked into queries.
This sub-project: many-to-many users ↔ workspaces via a join table, plus a pending invitations table. `workspaces.owner_id` stays as a denormalised pointer to the current owner; the `'owner'` row in `workspace_members` is the source of truth.

### Tables

```sql
-- existing — unchanged shape (owner_id stays as denormalised "current owner")
public.workspaces (
  id          uuid pk default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
)

-- NEW
public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner','admin','member')),
  joined_at    timestamptz default now() not null,
  primary key (workspace_id, user_id)
)
create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index workspace_members_workspace_id_idx on public.workspace_members(workspace_id);

-- NEW
public.invitations (
  id           uuid pk default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email        text not null,                                        -- lowercased on insert via trigger
  role         text not null check (role in ('admin','member')),     -- can't invite as owner
  token        text unique not null default encode(gen_random_bytes(24), 'base64url'),
  invited_by   uuid references auth.users(id) on delete set null,
  expires_at   timestamptz default (now() + interval '14 days') not null,
  accepted_at  timestamptz,
  created_at   timestamptz default now() not null
)
create unique index invitations_unique_pending
  on public.invitations(workspace_id, email)
  where accepted_at is null;
create index invitations_email_idx on public.invitations(email) where accepted_at is null;
create index invitations_token_idx on public.invitations(token);
```

### Triggers

1. **`on_workspace_created`** — `after insert on public.workspaces for each row`: insert `(NEW.id, NEW.owner_id, 'owner', now())` into `workspace_members`. Keeps the join table in sync.

2. **`on_owner_role_change`** — `before insert or update on public.workspace_members for each row when (NEW.role = 'owner')`: if there's an existing owner row for `NEW.workspace_id` with a different `user_id`, downgrade that row to `'admin'`. Then update `public.workspaces.owner_id = NEW.user_id`. Implements ownership transfer atomically — guarantees exactly one `'owner'` row per workspace.

3. **`on_invitation_email_normalise`** — `before insert or update on public.invitations for each row`: `NEW.email = lower(NEW.email)`. Avoids case-sensitivity bugs.

4. **Existing** `handle_new_user` (Foundation) — unchanged. Still creates the profile row.

### RLS rewrite

**`workspaces`** (replaces Foundation policies):

- `select`: any member of the workspace
- `insert`: any authenticated user (`owner_id = auth.uid()` enforced)
- `update`: owner or admin in this workspace
- `delete`: owner only

```sql
drop policy workspaces_select_own on public.workspaces;
drop policy workspaces_update_own on public.workspaces;
drop policy workspaces_delete_own on public.workspaces;
-- workspaces_insert_own remains: owner_id = auth.uid()

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
```

**`workspace_members`** (new):

```sql
alter table public.workspace_members enable row level security;

-- Visible to anyone in the same workspace
create policy members_select_same_workspace on public.workspace_members for select
  using (workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ));

-- Insert: only by owner/admin in the workspace, AND only via the
-- acceptInvitation Server Action path (action holds the service-role
-- key for this insert, bypassing RLS — so this policy mainly hardens
-- the boundary). Leave permissive insert closed.
-- (No INSERT policy → all client INSERTs blocked.)

-- Delete: owner/admin can remove anyone (except deleting an 'owner' row is blocked by trigger #2 logic — owner must transfer first); any non-owner can self-leave.
create policy members_delete_admin_or_self on public.workspace_members for delete
  using (
    (workspace_id in (
       select workspace_id from public.workspace_members
       where user_id = auth.uid() and role in ('owner','admin')
     ) and role <> 'owner')   -- can't remove the owner via direct delete
    or
    (user_id = auth.uid() and role <> 'owner')   -- self-leave for non-owners
  );

-- Update (role change): owner can change anyone; admin can change between admin/member only.
create policy members_update_admin on public.workspace_members for update
  using (workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and role in ('owner','admin')
  ))
  with check (
    -- Admin cannot promote anyone to owner. Only the trigger does that on transfer.
    (role <> 'owner') or
    (workspace_id in (
       select workspace_id from public.workspace_members
       where user_id = auth.uid() and role = 'owner'
     ))
  );
```

**`invitations`** (new):

```sql
alter table public.invitations enable row level security;

create policy invitations_select_admin_or_invitee on public.invitations for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
    or lower(email) = (select lower(email) from auth.users where id = auth.uid())
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
    or lower(email) = (select lower(email) from auth.users where id = auth.uid())
  );

-- Update: only the acceptInvitation Server Action (uses service-role key
-- to set accepted_at). No client UPDATE policy.
```

### Why this shape

- Splitting members from workspaces lets us scale teams without changing the workspaces table.
- Keeping `owner_id` on `workspaces` makes "list workspaces I own" a 1-table query and admin tooling simpler.
- The `unique(workspace_id, lower(email)) where accepted_at is null` partial index prevents duplicate pending invites without blocking re-invites after acceptance.
- Trigger #2 makes ownership transfer atomic at the DB layer, so the application never has to sequence two updates and risk a half-transfer state.
- The token is a 24-byte cryptographic random in `base64url` — 192 bits of entropy, URL-safe.

---

## Section 2: Routes & URL Refactor

### Route map

```
Marketing + Auth                  (unchanged from Foundation)

PUBLIC (NEW)
└── /invite/[token]               Accept-invite landing — handles signed-in / anonymous / wrong-email cases

PERSONAL APP CONTEXT  (no sidebar, just header with workspace switcher)
├── /app                          Redirect to /app/w/<recent-or-first>/dashboard, or /onboarding if no memberships
├── /app/settings
│   ├── /profile                  (same as Foundation — display name + avatar)
│   └── /account                  (same — sign out, delete account, with last-owner-protection)
└── /app/invitations              Pending invites for this user — accept / decline

WORKSPACE CONTEXT  (full sidebar, header shows workspace switcher with current = active)
└── /app/w/[slug]
    ├── /                         Redirect to /dashboard
    ├── /dashboard                (moved from /app/dashboard)
    ├── /campaigns                (moved)
    ├── /connections              (moved)
    ├── /automation               (moved)
    ├── /reports                  (moved)
    └── /settings
        ├── /general              Workspace name (moved + renamed from /app/settings/workspace)
        ├── /members              List, invite (email + copy-link), change role, remove
        └── /danger               Transfer ownership, delete workspace
```

### Two distinct app layouts

| Layout                            | Wraps                                              | Chrome                                                                                                                                          |
| --------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/app/layout.tsx`          | `/app/page`, `/app/settings/*`, `/app/invitations` | Top header only — workspace switcher (label: "Personal") + user menu. **No sidebar.** Pre-fetches the user's workspace memberships server-side. |
| `src/app/app/w/[slug]/layout.tsx` | All `/app/w/<slug>/*`                              | Top header (workspace switcher with active = `<slug>`, user menu) + classic left sidebar. Calls `requireMember(slug)` first; redirects on miss. |

### Workspace switcher dropdown (in header, both layouts)

- Active workspace name with chevron
- Dropdown contents: list of workspaces user belongs to (active one checkmarked, up to 8 inline, scrollable beyond)
- "+ New workspace" → opens `CreateWorkspaceDialog`
- "View all workspaces" → `/app`

Switching: client navigation to `/app/w/<target>/dashboard`. Proxy writes the cookie on arrival.

### `/app` redirect logic

```
/app
├─ read cookie 'recent_workspace_slug'
├─ if cookie set AND user is still a member of that slug → 307 to /app/w/<slug>/dashboard
├─ else: query workspace_members for user, pick most recently joined
├─    if any → 307 to /app/w/<slug>/dashboard
└─    else → 307 to /onboarding
```

### Foundation routes that disappear

| Old                       | New                              |
| ------------------------- | -------------------------------- |
| `/app/dashboard`          | `/app/w/<slug>/dashboard`        |
| `/app/campaigns`          | `/app/w/<slug>/campaigns`        |
| `/app/connections`        | `/app/w/<slug>/connections`      |
| `/app/automation`         | `/app/w/<slug>/automation`       |
| `/app/reports`            | `/app/w/<slug>/reports`          |
| `/app/settings/workspace` | `/app/w/<slug>/settings/general` |
| `/app/settings/profile`   | (unchanged)                      |
| `/app/settings/account`   | (unchanged)                      |

### Back-compat redirects in proxy

`src/proxy.ts` adds redirects: any GET on `/app/<old-path>` (with no `<slug>` segment, where `<old-path>` is one of the moved routes) → 307 to `/app/w/<recent>/<old-path>`. Insurance against stale bookmarks. Deletable later.

---

## Section 3: Auth, Proxy & RBAC Enforcement

### Three layers of defence

| Layer                       | What it stops                                                      | When                                        |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| **RLS** (Postgres)          | Reading or writing data you shouldn't — final authority            | Every query                                 |
| **Proxy** (`src/proxy.ts`)  | Fast UX redirects (anon → /log-in, non-member → /app, stale paths) | Every protected request                     |
| **Layout / Server Actions** | Showing the wrong UI; permitting an action you don't have role for | Server-side render + before any DB mutation |

### Proxy changes

Adds three behaviours to Foundation's `src/proxy.ts`:

1. **`/app/w/[slug]/*` membership check** — query `workspace_members` for `(user_id, slug)`. If none: redirect to `/app`.
2. **Recent-workspace cookie** — on every `/app/w/[slug]/*` hit, write `recent_workspace_slug = <slug>` (httpOnly, secure, sameSite=lax, 30-day max-age).
3. **Back-compat redirects** — old Foundation paths → 307 to `/app/w/<recent>/<sub-path>`.

### Membership helper — `src/lib/auth/membership.ts`

```ts
type Role = 'owner' | 'admin' | 'member'

export async function getMembership(slug: string): Promise<{
  role: Role
  workspaceId: string
  workspaceName: string
} | null>

// Throws redirect to /app if user is not a member of slug.
export async function requireMember(slug: string): Promise<{
  role: Role
  workspaceId: string
  workspaceName: string
}>

// Throws redirect to /app/w/<slug>/dashboard if user's role isn't allowed.
export async function requireRole(
  slug: string,
  allowed: Role[],
): Promise<{
  role: Role
  workspaceId: string
  workspaceName: string
}>
```

Used by:

- `app/w/[slug]/layout.tsx`: `requireMember(slug)`
- `/settings/general` page: `requireRole(slug, ['owner','admin'])`
- `/settings/members` page: `requireMember(slug)` (everyone sees the list; UI gates actions by role)
- `/settings/danger` page: `requireRole(slug, ['owner'])`
- Every Server Action: re-verifies (defence-in-depth, never trust the layout's role)

### Server Actions

**New** (`src/lib/actions/workspaces.ts`):

```ts
createWorkspace(formData: FormData)
  // Auth'd user. Inserts workspace; trigger gives them owner. Sets cookie. Redirect to /app/w/<slug>/dashboard.

inviteMember(slug: string, formData: FormData) → { token: string, link: string } | { error: string }
  // requireRole(slug, ['owner','admin']). Creates invitation row.
  // Calls supabase.auth.admin.inviteUserByEmail(email, { redirectTo: ${SITE_URL}/invite/<token> }).
  // Returns the link so the UI can show "copy".

revokeInvitation(invitationId: string)
  // requireRole-of-invitation's-workspace ['owner','admin']. Deletes row.

acceptInvitation(token: string) → { slug: string } | { error: string }
  // Public-ish (server action). Service-role lookup of invitation by token.
  // Validates: not accepted, not expired, caller's email matches invitation.email (case-insensitive).
  // Inserts into workspace_members via service role. Marks accepted_at. Sets cookie.

declineInvitation(invitationId: string)
  // Caller's email must match. Deletes row.

removeMember(slug: string, userId: string)
  // requireRole(slug, ['owner','admin']). Cannot remove the owner. Owner cannot remove self.

leaveWorkspace(slug: string)
  // requireMember(slug). Caller's role must not be 'owner'. Self-deletes membership row.

changeMemberRole(slug: string, userId: string, newRole: 'admin' | 'member')
  // requireRole(slug, ['owner','admin']). Admin can only change between admin↔member.
  // Owner can change anyone (use transferOwnership for promotion to owner).

transferOwnership(slug: string, newOwnerUserId: string)
  // requireRole(slug, ['owner']). Updates the new member's row to role='owner';
  // trigger atomically downgrades current owner to admin and updates workspaces.owner_id.

deleteWorkspace(slug: string)
  // requireRole(slug, ['owner']). Deletes the row; FK cascade removes everything.
```

**Edited** (Foundation):

- `updateWorkspace(slug: string, formData: FormData)` — now scoped by slug. requireRole(slug, ['owner','admin']).
- `deleteAccount()` — additional check: if user owns any workspace where `(select count(*) from workspace_members where workspace_id = w.id) > 1`, return `{ error: 'You own a workspace with other members. Transfer ownership or delete the workspace first.' }`. Otherwise delete (cascade removes single-member workspaces).
- `createInitialWorkspace(formData)` — kept; called only from onboarding. Internally identical to `createWorkspace` but the redirect target is the same dashboard URL.

### Public `/invite/[token]` flow

```
GET /invite/<token>
├─ service-role lookup of invitation by token
├─ not found / expired / already accepted → render error card
├─ user signed in:
│   ├─ caller email matches invitation email → render "Accept invitation" button → acceptInvitation
│   └─ caller email does not match → render error: "Sent to <invite.email>. Sign out and switch accounts."
└─ user anonymous:
    ├─ "Sign up to accept" → /sign-up?invite_token=<token>&email=<prefilled>
    └─ "I have an account" → /log-in?invite_token=<token>
```

`signUp` and `logIn` Server Actions read optional `invite_token` from the URL after auth and call `acceptInvitation(token)` before the final redirect.

### Last-owner protection

`deleteAccount()` returns the inline error described above. The `/app/settings/account` page shows the error inline with a link to the offending workspace's danger page.

### Cookie writes (server-side only)

- Proxy on every `/app/w/[slug]/*` request
- `acceptInvitation` action before its redirect
- `createWorkspace` action before its redirect

---

## Section 4: UI Flows & Components

### Workspace switcher (header, both layouts)

A button showing the active workspace name (or "Personal" on personal-context pages), with a chevron. Click → dropdown with active workspace checkmarked, list of other workspaces (max 8 inline + scroll), "+ New workspace" button (opens `CreateWorkspaceDialog`), "View all workspaces" link to `/app`.

### `CreateWorkspaceDialog`

Single text input (workspace name). Submit → `createWorkspace` Server Action → action returns slug → client navigates to `/app/w/<slug>/dashboard`.

### Members page (`/app/w/[slug]/settings/members`)

Three sections stacked:

1. **Members table** (server component)
   - Columns: avatar, display-name + email, role badge, role-change `Select`, remove button
   - "you" badge next to caller's row
   - Owner sees all controls; admin sees all controls except cannot change owner's row; member sees a read-only list

2. **Invite section** (client component, owner+admin only)
   - Email input, role radio (member / admin), "Send invite" button
   - On success: shows "✓ Invited carol@…" + a copy-link button next to it (link is the same URL Supabase emailed)

3. **Pending invitations** (server data, client revoke action)
   - Email, role, sent-at, "Revoke" button (owner+admin only)

### Danger zone (`/app/w/[slug]/settings/danger`) — owner only

Two cards stacked:

- **Transfer ownership**: dropdown of admins+members, "Transfer" button. Server action calls `transferOwnership`. After: caller becomes admin; redirect to dashboard.
- **Delete workspace**: red-bordered card. Type-the-name-to-confirm input (client component, compares to workspace name and toggles button disabled). Submit → `deleteWorkspace` → redirect to `/app`.

### `/invite/[token]` landing (public)

Centered card (similar visual shape to `AuthCard`). Three branches based on auth state + email match (see Section 3).

### Pending invitations page (`/app/invitations`)

List of pending invitations. Each row: workspace name, role badge, "invited by", Accept + Decline buttons. Empty state: "You're all caught up."

### Pending-invites banner

Server component shown on personal-context pages (`/app`, `/app/settings/*`) when count > 0:

> Yellow banner: "You have N pending invitations. View →" (links to `/app/invitations`)

### New components inventory

| Component                | Type                               | File                                              |
| ------------------------ | ---------------------------------- | ------------------------------------------------- |
| `WorkspaceSwitcher`      | Client                             | `src/components/app/workspace-switcher.tsx`       |
| `CreateWorkspaceDialog`  | Client                             | `src/components/app/create-workspace-dialog.tsx`  |
| `WorkspaceMembersTable`  | Server                             | `src/components/app/workspace-members-table.tsx`  |
| `RoleSelect`             | Client                             | `src/components/app/role-select.tsx`              |
| `RemoveMemberButton`     | Client                             | `src/components/app/remove-member-button.tsx`     |
| `InviteSection`          | Client                             | `src/components/app/invite-section.tsx`           |
| `PendingInvitationsList` | Server-data + client-actions split | `src/components/app/pending-invitations-list.tsx` |
| `InviteAcceptCard`       | Server                             | `src/components/app/invite-accept-card.tsx`       |
| `TransferOwnershipForm`  | Client                             | `src/components/app/transfer-ownership-form.tsx`  |
| `DeleteWorkspaceForm`    | Client                             | `src/components/app/delete-workspace-form.tsx`    |
| `PendingInvitesBanner`   | Server                             | `src/components/app/pending-invites-banner.tsx`   |

shadcn primitives to add: `select`, `table`.

### Empty states (using existing `EmptyState`)

- **Members page**, just owner: "Just you so far — invite your team to collaborate."
- **Pending invitations page**, none: "You're all caught up."

### E2E tests (Playwright)

Foundation E2E (auth happy path + marketing) stays. Add:

- `tests/e2e/workspaces.spec.ts` — sign-up → onboarding creates first workspace → "+ New workspace" via switcher → switch back and forth → verify URL changes and dashboard renders for each. Cleanup deletes the test user.
- `tests/e2e/invite.spec.ts` — sign up user A → invite user B by email → fetch token via service-role admin client → as anonymous user visit `/invite/<token>` → sign up via the invite → verify lands on the workspace dashboard as `member`. Cleanup deletes both users.

---

## Acceptance Criteria

A logged-in user can:

- [ ] Create a new workspace from the switcher; lands on its dashboard
- [ ] See all workspaces they belong to in the switcher; the active one is checkmarked
- [ ] (Owner+admin only) Invite a member by email; recipient gets an email with a link
- [ ] (Owner+admin only) Copy an invite link; pasting it into a fresh browser, signing up + accepting works
- [ ] (Owner+admin only) Change an existing member's role between admin and member
- [ ] (Owner only) Transfer ownership; previous owner becomes admin; new owner gains all owner-only operations
- [ ] (Owner only) Delete the workspace; cascade-removes all data (members, invitations, future ad-account connections)
- [ ] (Member or admin only — not owner) Leave a workspace
- [ ] (Owner of a multi-member workspace) Cannot delete their account; sees the inline error directing them to transfer or delete the workspace
- [ ] (User with no owned multi-member workspaces) Can delete their account; cascade removes single-member workspaces
- [ ] Cross-workspace isolation: a member of workspace A cannot read members or invitations of workspace B (RLS enforces; verified by direct Supabase query in unit testing or Studio inspection)

Quality gates:

- [ ] All previous quality gates from Foundation still pass (format, lint, typecheck, build, Playwright E2E)
- [ ] New Playwright tests `workspaces.spec.ts` and `invite.spec.ts` pass
- [ ] All marketing + auth pages still 200; protected pages still 307 → /log-in; protected pages with active workspace still 200; back-compat redirects work
- [ ] `/api/health` still 200

---

## Open questions deferred to implementation

- Avatar storage for invitations (e.g., showing "invited by" avatar in pending list) — uses the inviter's already-existing avatar; no new bucket policies needed.
- Email template for invitation: Supabase's default invite email is functional but plain. Customising is a Supabase project setting; can be done outside code in a follow-up.
- Concurrent ownership-transfer race: two owners (impossible by trigger #2 invariant), but two simultaneous transfer attempts could race. The trigger's atomic swap protects us — last writer wins; the loser's transfer reflects the new state correctly.
- Soft delete for workspaces — not implemented. Deletion is permanent (consistent with Foundation's `deleteAccount`).
- Members page: do we paginate when a workspace has 100+ members? Out of scope for v1; flat list is fine until proven otherwise.
