# Sub-Project 1: Foundation — Design Spec

**Date:** 2026-04-22
**Status:** Approved by user, ready for implementation planning
**Effort estimate:** ~1 week solo full-time

## Goal

Stand up the bare-bones autoads application: a deployed Next.js app with marketing site, email-password authentication, single-question onboarding, and an authenticated app shell with empty-state placeholders for every future section. **Nothing in this sub-project depends on Google Ads or Meta APIs** — those land in sub-project 3.

## Non-goals

- Workspace member management, invites, or RBAC (sub-project 2)
- Multi-workspace switcher (sub-project 2)
- Ad-account OAuth (sub-project 3)
- Real campaign / spend / ROAS data (sub-projects 4, 5)
- Ad creation UI (sub-project 6)
- Automation rules (sub-project 7)
- Email or in-app notifications beyond Supabase auth defaults (sub-project 8)
- Stripe billing or paid plans (sub-project 9)
- Custom email templates (Supabase defaults for v1)
- Custom domain (use `autoads.vercel.app` until purchased)
- Blog content (scaffold ships empty)

---

## Section 1: Architecture & Data Model

### Architecture

A single Next.js 15 (App Router) application deployed to Vercel, talking to one Supabase project. No microservices, no separate backend, no monorepo. Everything in one repo at `/Users/marios/Desktop/Cursor/autoads/`.

```
┌─────────────────────────────────────┐         ┌──────────────────────┐
│  Next.js 15 (App Router)            │ ◄─────► │  Supabase project    │
│  - Marketing pages (RSC, static)    │  HTTPS  │  - Postgres          │
│  - App pages (RSC + Server Actions) │         │  - Auth (email/pwd)  │
│  - API routes (only when needed)    │         │  - Storage (later)   │
│  Hosted on Vercel                   │         │  Hosted on Supabase  │
└─────────────────────────────────────┘         └──────────────────────┘
            │
            ├─→ PostHog (product analytics, client + server)
            └─→ Sentry (error tracking, server + client)
```

**Three runtime contexts in the Next.js app:**
1. **Marketing** (`/`, `/pricing`, `/faq`, `/blog`, `/features/*`, `/legal/*`) — public, mostly statically generated.
2. **Auth** (`/sign-up`, `/log-in`, `/forgot-password`, `/reset-password`) — public, dynamic, server-rendered.
3. **App** (`/onboarding`, `/app/*`) — protected by middleware, server-rendered.

### Data Model

```sql
-- Managed by Supabase Auth
auth.users (
  id          uuid primary key,
  email       text,
  created_at  timestamptz
);

-- App-specific writable companion to auth.users
public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

-- One row per user in this phase; gains members in sub-project 2
public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);
```

### RLS policies

```sql
-- profiles: users see/update their own row only
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select
  using (id = auth.uid());
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: users see workspaces they own (extends to "or member of" in sub-project 2)
alter table public.workspaces enable row level security;
create policy workspaces_select_own on public.workspaces for select
  using (owner_id = auth.uid());
create policy workspaces_insert_own on public.workspaces for insert
  with check (owner_id = auth.uid());
create policy workspaces_update_own on public.workspaces for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy workspaces_delete_own on public.workspaces for delete
  using (owner_id = auth.uid());
```

### Sign-up trigger

When a new row appears in `auth.users`, automatically insert a matching `profiles` row. The corresponding `workspaces` row is created later by the onboarding Server Action (which has the workspace name from the form).

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### Why this shape

- **Profiles separated from `auth.users`** — Supabase's auth table is read-mostly from app code; we want a writable companion for app-specific fields.
- **Workspaces own from day one** — even though Foundation has only one workspace per user, the `owner_id` column means sub-project 2 adds `workspace_members` without a breaking schema change.
- **Slugs from day one** — so future URLs like `/app/w/acme-co/dashboard` don't require a backfill.

---

## Section 2: Routes & UI Structure

### Route map

```
Marketing (public, statically generated)
├── /                        landing page
├── /pricing                 three-tier pricing page (Free / Pro / Business)
├── /features                features index
│   ├── /features/google-ads
│   ├── /features/meta-ads
│   └── /features/automation
├── /faq
├── /blog                    scaffold only — empty list page
├── /blog/[slug]             dynamic MDX route (works but no posts yet)
├── /legal/privacy
└── /legal/terms

Auth (public, server-rendered)
├── /sign-up                 email + password
├── /log-in                  email + password + "forgot password" link
├── /forgot-password         email input → triggers Supabase password-reset email
└── /reset-password          new-password form (lands here from email link)

App (protected by middleware)
├── /onboarding              workspace name (single-question)
├── /app                     redirect to /app/dashboard
├── /app/dashboard           KPI stat cards (all empty) + "connect first account" CTA
├── /app/campaigns           empty-state placeholder
├── /app/connections         empty-state placeholder
├── /app/automation          empty-state placeholder
├── /app/reports             empty-state placeholder
└── /app/settings
    ├── /app/settings/profile       display name + avatar upload
    ├── /app/settings/workspace     workspace name edit
    └── /app/settings/account       danger zone: delete account, sign out from all devices

API
└── /api/health              200 OK for uptime monitoring
```

### Three layout shells (using App Router route groups)

```
src/app/
├── (marketing)/layout.tsx   top nav + footer; no sidebar
├── (auth)/layout.tsx        centered card on neutral background; wordmark top-left
├── onboarding/page.tsx      centered card layout; uses (auth) layout shape
└── app/layout.tsx           classic left sidebar + top header + main content
```

The sidebar shows: Dashboard, Campaigns, Connections, Automation, Reports, Settings. The header shows: workspace name (no switcher in this phase) + user menu (Profile, Sign out, Theme toggle).

### Components built in Foundation

| Component | Source | Notes |
|---|---|---|
| `Button`, `Input`, `Label`, `Card`, `Dialog`, `DropdownMenu`, `Avatar`, `Skeleton`, `Toast` | shadcn/ui | Copy-pasted into `src/components/ui/` |
| `Logo` | custom | Wordmark "autoads" in indigo-600; size prop |
| `ThemeToggle` | custom | `next-themes`; light / dark / system |
| `MarketingHeader`, `MarketingFooter` | custom | |
| `AuthCard` | custom | Wraps sign-up/log-in/reset forms |
| `AppSidebar`, `AppHeader` | custom | Sidebar with active-state styling; header with workspace name + user menu |
| `EmptyState` | custom | Reused on every stub page (icon + title + description + optional CTA) |
| `StatCard` | custom | KPI card (label + value + trend); shows "—" everywhere in v1 |
| Form primitives | shadcn + React Hook Form + Zod | |
| **Marketing-page sections:** `Hero`, `FeatureGrid`, `HowItWorksSteps`, `PricingTierCards`, `FAQAccordion`, `CTASection`, `FeaturePageHero`, `LegalPageContainer`, `BlogList`, `BlogPostLayout` | custom | Used to compose the marketing pages. **`PricingTierCards` shows the three plan names (Free / Pro / Business) with bullet feature lists but uses placeholder copy ("Pricing announced soon") for actual prices — real prices land in sub-project 9.** |

### Server vs client rendering

- **Default: Server Components** for all pages.
- **`"use client"` only for:** `ThemeToggle`, `AppSidebar` (needs `usePathname` for active state), forms (React Hook Form), user-menu `DropdownMenu`. Keep client bundle small.
- **Server Actions** handle: sign-up, log-in, log-out, password reset, profile update, workspace update, account delete. **No API routes for these.**

---

## Section 3: Auth & Onboarding Flows

### Sign-up

```
/sign-up
  ├─ Form: email, password (min 8 chars, ≥1 letter, ≥1 digit)
  ├─ Submit → Server Action `signUp(formData)`
  │   ├─ supabase.auth.signUp({ email, password })  // no email verification configured
  │   ├─ trigger inserts row in `profiles` (display_name = null)
  │   ├─ supabase.auth.signInWithPassword (auto-login)
  │   └─ PostHog: "user_signed_up" { email_domain, signup_method: "password" }
  ├─ Success → redirect to /onboarding
  └─ Error (e.g. duplicate email) → inline error, stay on /sign-up
```

### Onboarding

```
/onboarding   (protected; reachable only when logged-in AND no workspace exists)
  ├─ Form: workspace_name (text, max 60 chars)
  ├─ Submit → Server Action `createInitialWorkspace(name)`
  │   ├─ slug = slugify(name) + collision suffix if needed
  │   ├─ INSERT into `workspaces` (name, slug, owner_id = auth.uid())
  │   └─ PostHog: "onboarding_completed" { workspace_name_length }
  └─ Redirect to /app/dashboard
```

Middleware guarantees:
- Logged-in user with no workspace landing on `/app/*` → redirected to `/onboarding`
- Logged-in user with a workspace landing on `/onboarding`, `/sign-up`, or `/log-in` → redirected to `/app/dashboard`
- Anonymous user landing on `/app/*` or `/onboarding` → redirected to `/log-in?redirect=<original>`

### Log-in

```
/log-in
  ├─ Form: email, password
  ├─ Links: "Forgot password?", "Don't have an account? Sign up"
  ├─ Submit → Server Action `logIn(formData)`
  │   ├─ supabase.auth.signInWithPassword({ email, password })
  │   └─ PostHog: "user_logged_in" { email_domain }
  ├─ Success → redirect to /app/dashboard (or to `?redirect=` destination)
  └─ Error → generic "Invalid email or password" inline (don't leak email existence)
```

### Forgot / reset password

```
/forgot-password
  ├─ Form: email
  ├─ Submit → Server Action calls supabase.auth.resetPasswordForEmail
  │   with redirectTo = `${SITE_URL}/reset-password`
  └─ Show generic success state regardless of whether email exists

/reset-password   (lands here from email link with one-time token in URL)
  ├─ Form: new password, confirm new password
  ├─ Submit → Server Action calls supabase.auth.updateUser({ password })
  └─ Success → redirect to /app/dashboard with success toast
```

### Sign-out

User menu → "Sign out" → Server Action calls `supabase.auth.signOut()` → redirect to `/`.

### Session management

- **Cookie-based sessions** via `@supabase/ssr` (NOT the deprecated `@supabase/auth-helpers-nextjs`).
- **`middleware.ts`** at project root runs on `/app/*` and `/onboarding`. It refreshes the Supabase session silently and applies the redirect rules above.
- **`createServerClient()`** for Server Components and Server Actions (auto-passes cookies).
- **`createBrowserClient()`** only for the rare client component that genuinely needs Supabase directly.

### Password policy

- Min 8 chars, must contain ≥1 letter and ≥1 digit. Configured in Supabase project settings (no app-side validation duplicates).
- No max length, no special-character requirement.

### Security hardening included in Foundation

- CSRF: free with Next.js Server Actions (built-in same-origin enforcement)
- Rate limiting: Supabase Auth's built-in per-IP limits on sign-up / log-in / reset
- HTTPS-only: enforced by Vercel
- Cookie flags: `httpOnly`, `secure`, `sameSite=lax` (defaults from `@supabase/ssr`)
- All sensitive routes protected at middleware layer, not by UI hiding alone
- Login + forgot-password do not reveal whether an email is registered

### Analytics events

| Event | Properties | Where fired |
|---|---|---|
| `user_signed_up` | `email_domain`, `signup_method` | sign-up Server Action |
| `onboarding_completed` | `workspace_name_length` | onboarding Server Action |
| `user_logged_in` | `email_domain` | log-in Server Action |
| `user_logged_out` | — | sign-out Server Action |
| `dashboard_viewed` | `is_first_view` (boolean) | `/app/dashboard` page |
| `password_reset_requested` | — | forgot-password Server Action |

---

## Section 4: Project Setup, DX & Deployment

### Folder structure

```
autoads/
├── .env.example
├── .env.local                       (gitignored)
├── .gitignore
├── .nvmrc                           "20"
├── .prettierrc
├── eslint.config.mjs
├── middleware.ts                    session refresh + route protection
├── next.config.ts
├── tailwind.config.ts, postcss.config.mjs, tsconfig.json
├── playwright.config.ts, vitest.config.ts
├── package.json, pnpm-lock.yaml
├── README.md
├── public/                          favicon.ico, og.png
├── src/
│   ├── app/                         (see route map in Section 2)
│   │   ├── (marketing)/...
│   │   ├── (auth)/...
│   │   ├── onboarding/page.tsx
│   │   ├── app/...
│   │   ├── api/health/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                      shadcn primitives
│   │   ├── marketing/, auth/, app/, shared/
│   ├── lib/
│   │   ├── supabase/                server.ts, client.ts, middleware.ts
│   │   ├── actions/                 auth.ts, onboarding.ts, profile.ts, workspace.ts, account.ts
│   │   ├── posthog/                 server.ts, client.ts
│   │   ├── sentry/
│   │   ├── env.ts                   t3-env validated env schema
│   │   ├── utils.ts                 cn() and tiny helpers
│   │   └── slug.ts
│   ├── db/
│   │   ├── schema.ts                Drizzle schema
│   │   └── types.ts                 Supabase-generated TS types (gitignored, regenerated)
│   └── hooks/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_initial_profiles_workspaces.sql
│   │   └── 0002_signup_trigger.sql
│   └── seed.sql
├── tests/
│   ├── unit/                        slug.test.ts, env.test.ts
│   └── e2e/                         auth.spec.ts, marketing.spec.ts
└── .github/workflows/
    ├── ci.yml                       typecheck + lint + unit + build + e2e
    └── deploy.yml                   migrations on merge to main
```

### Environment variables

Validated by `@t3-oss/env-nextjs` in `src/lib/env.ts`. App fails fast at startup if anything is missing/malformed.

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only
DATABASE_URL=                        # for Drizzle direct connection

# Site
NEXT_PUBLIC_SITE_URL=https://autoads.vercel.app

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Error tracking
SENTRY_DSN=
SENTRY_AUTH_TOKEN=                   # for source-map upload at build time
```

`.env.example` committed; `.env.local` gitignored.

### Local dev setup

```bash
git clone git@github.com:marios/autoads.git
cd autoads
pnpm install
supabase start                       # Postgres + Auth + Studio in Docker
supabase db reset                    # apply migrations + seed
pnpm db:types                        # generate TS types from local DB
cp .env.example .env.local           # then fill from `supabase status` output
pnpm dev                             # http://localhost:3000
```

`pnpm` scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `db:types`, `db:push`, `db:diff`.

### CI/CD

**Vercel** auto-deploys: branch push → preview at `<branch>-autoads.vercel.app`; merge to `main` → production at `autoads.vercel.app`.

**GitHub Actions `ci.yml`** (every PR): checkout, install pnpm w/ cache, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e` (against fresh local Supabase).

**`deploy.yml`** (push to `main`, after Vercel finishes): `supabase db push --linked` to apply migrations to prod. Requires `SUPABASE_ACCESS_TOKEN` repo secret.

### Testing strategy

| Layer | Tool | What's covered in Foundation |
|---|---|---|
| **Unit** | Vitest | `slug()` collision handling + edge cases; `env.ts` validation throws; middleware path matchers |
| **E2E** | Playwright | (1) full happy path: visit `/`, click "Sign up", complete sign-up, name workspace, land on dashboard, sign out. (2) marketing pages return 200 with no console errors. |
| **Component** | — | None at Foundation |
| **Visual regression** | — | Deferred |

### Pre-commit hooks (Husky + lint-staged)

On `git commit`: ESLint --fix + Prettier --write on staged files; full repo typecheck (~3s incremental).

### Error tracking & analytics

- **Sentry**: `withErrorTracking()` helper wraps Server Actions, re-throws after `Sentry.captureException`. Source maps uploaded at build. Free tier (5k errors/mo).
- **PostHog**: client SDK in `app/layout.tsx`; `posthog.identify()` once on sign-in. Server events from Server Actions via `posthog-node`. Autocapture on, session recording off.

---

## Acceptance Criteria

A new visitor can:
- [ ] Land on `/`, see the marketing page, click "Sign up"
- [ ] Sign up with email + password, name their workspace, land on `/app/dashboard`
- [ ] See empty-state placeholders on every protected page
- [ ] Toggle light / dark / system theme
- [ ] Sign out, sign back in
- [ ] Reset password via email
- [ ] Update display name in `/app/settings/profile`
- [ ] Update workspace name in `/app/settings/workspace`
- [ ] Delete account (cascade-deletes workspace)

Quality gates:
- [ ] All marketing pages return 200; Lighthouse landing page ≥90 perf / ≥95 a11y
- [ ] All `/app/*` routes redirect to `/log-in` when unauthenticated
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` all green
- [ ] PostHog receives real events; Sentry receives a deliberate test error
- [ ] `/api/health` returns 200
- [ ] `/app/dashboard` first-load JS bundle <120KB

---

## Open questions deferred to implementation

- Exact Tremor vs custom chart strategy on the dashboard (no charts in Foundation, just empty `StatCard`s — decide for sub-project 5)
- Whether `account` deletion should be soft-delete or hard-delete — Foundation does **hard delete via Supabase Auth API**, cascading workspaces; revisit if recovery is needed.
- Avatar storage: a public Supabase Storage bucket `avatars` is created in Foundation with RLS policy "anyone can read; users can insert/update/delete only objects under `avatars/${auth.uid()}/*`". Bucket creation lands in the migration files; the precise upload component (drag-drop vs file picker) is decided during plan execution.
- Marketing page copy (hero text, feature blurbs, FAQ Q&As) is treated as content-fill during implementation — the implementation plan will include placeholder copy that the user can later edit. No copywriting blocked on this spec.
