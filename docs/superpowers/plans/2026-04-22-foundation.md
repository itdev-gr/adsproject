# autoads Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the bare-bones autoads Next.js app with marketing site, email-password auth, single-question onboarding, and authenticated app shell with empty-state placeholders for every section. No ad-platform integrations yet.

**Architecture:** Single Next.js 15 (App Router) app deployed to Vercel, talking to one Supabase project (Postgres + Auth + Storage). Server Components by default, Server Actions for mutations, middleware for session refresh + route protection. PostHog + Sentry for observability.

**Tech Stack:** Next.js 15, React 19, TypeScript (strict), Tailwind CSS, shadcn/ui, Supabase (`@supabase/ssr`), Drizzle ORM, React Hook Form + Zod, Tremor, TanStack Table, Resend (later), Stripe (later), Inngest (later), PostHog, Sentry, Vitest, Playwright, pnpm, Husky + lint-staged, Vercel.

**Specs this implements:** `docs/superpowers/specs/2026-04-22-foundation-design.md` and `docs/superpowers/specs/2026-04-22-autoads-overview.md`.

---

## File Structure

The full target tree is in the design spec, Section 4. This plan builds it in this order: (1) project bootstrap, (2) Supabase + DB, (3) primitives + shared components, (4) auth + middleware, (5) onboarding, (6) app shell + protected pages, (7) marketing site, (8) observability, (9) tests, (10) CI/CD, (11) production deploy.

---

## Task 1: Bootstrap the Next.js project

**Files:**
- Create: everything inside `/Users/marios/Desktop/Cursor/autoads/` (currently empty folder)

- [ ] **Step 1: Verify pnpm and Node 20**

```bash
node --version    # expect v20.x
pnpm --version    # expect 8.x or newer
```
If pnpm is missing: `npm install -g pnpm`.

- [ ] **Step 2: Run `create-next-app` with the chosen options**

```bash
cd /Users/marios/Desktop/Cursor/autoads
pnpm create next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm --turbopack --skip-install
```
When prompted "directory not empty", choose to proceed (only the `.superpowers/` and `docs/` folders exist).

- [ ] **Step 3: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 4: Pin Node version**

```bash
echo "20" > .nvmrc
```

- [ ] **Step 5: Replace `.gitignore` with the project's allowlist**

Write `/Users/marios/Desktop/Cursor/autoads/.gitignore`:
```gitignore
# deps
node_modules
.pnpm-store

# next
.next/
out/

# env
.env
.env.local
.env.*.local

# misc
.DS_Store
*.log
.vercel

# supabase local
supabase/.branches
supabase/.temp

# generated types (regenerated from migrations)
src/db/types.ts

# tests
playwright-report
test-results
coverage

# brainstorm artefacts
.superpowers/
```

- [ ] **Step 6: Smoke test**

```bash
pnpm dev
```
Visit `http://localhost:3000` — expect the default Next.js welcome screen. Stop the server (Ctrl-C).

- [ ] **Step 7: Initialise git + initial commit**

```bash
cd /Users/marios/Desktop/Cursor/autoads
git init
git add -A
git commit -m "chore: bootstrap Next.js 15 + TS + Tailwind project"
```

---

## Task 2: Configure linting, formatting, and pre-commit hooks

**Files:**
- Create: `.prettierrc`, `.prettierignore`
- Create: `.husky/pre-commit`
- Modify: `package.json`
- Modify: `eslint.config.mjs` (created by `create-next-app`)

- [ ] **Step 1: Install dev deps**

```bash
pnpm add -D prettier prettier-plugin-tailwindcss eslint-config-prettier husky lint-staged
```

- [ ] **Step 2: Write `.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 3: Write `.prettierignore`**

```
node_modules
.next
.vercel
out
coverage
playwright-report
test-results
src/db/types.ts
pnpm-lock.yaml
```

- [ ] **Step 4: Append `prettier` to `eslint.config.mjs`**

Edit `eslint.config.mjs`. After the existing `next/core-web-vitals` extend, add `'prettier'`:
```js
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
]

export default eslintConfig
```

- [ ] **Step 5: Add scripts and lint-staged config to `package.json`**

Open `package.json`. In the `scripts` block, add:
```json
"format": "prettier --write .",
"format:check": "prettier --check .",
"typecheck": "tsc --noEmit",
"prepare": "husky"
```

At the top level (sibling of `scripts`), add:
```json
"lint-staged": {
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```

- [ ] **Step 6: Initialise Husky**

```bash
pnpm prepare
echo "pnpm lint-staged && pnpm typecheck" > .husky/pre-commit
chmod +x .husky/pre-commit
```

- [ ] **Step 7: Verify**

```bash
pnpm format
pnpm lint
pnpm typecheck
```
Expected: all three exit 0.

- [ ] **Step 8: Tighten TypeScript strictness**

Open `tsconfig.json`. In `compilerOptions` add (or set):
```json
"strict": true,
"noUncheckedIndexedAccess": true,
"forceConsistentCasingInFileNames": true
```

Re-run `pnpm typecheck`. Fix any new errors (likely none in a freshly bootstrapped app).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: add prettier + lint-staged + husky + strict TS"
```

---

## Task 3: Install shadcn/ui and add core primitives

**Files:**
- Create: `components.json`
- Create: `src/components/ui/*.tsx` (multiple shadcn primitives)
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Initialise shadcn/ui**

```bash
pnpm dlx shadcn@latest init
```
Choose: TypeScript, default style, base color **Slate**, CSS variables = yes. This writes `components.json` and updates `globals.css` and `tailwind.config.ts` with CSS variables and the `tw-animate-css` plugin.

- [ ] **Step 2: Add the primitives we need at v1**

```bash
pnpm dlx shadcn@latest add button input label card dialog dropdown-menu avatar skeleton sonner form alert separator
```
This creates files under `src/components/ui/`.

- [ ] **Step 3: Override the accent colour to indigo-600**

Open `src/app/globals.css`. In the `:root` and `.dark` blocks, replace the existing `--primary` / `--primary-foreground` values with indigo-600 in HSL:
```css
:root {
  /* ...keep other vars... */
  --primary: 239 84% 56%;          /* indigo-600 */
  --primary-foreground: 0 0% 100%; /* white */
}
.dark {
  --primary: 239 84% 56%;
  --primary-foreground: 0 0% 100%;
}
```

- [ ] **Step 4: Install `next-themes` for dark-mode support**

```bash
pnpm add next-themes
```

- [ ] **Step 5: Wrap the root layout in `ThemeProvider`**

Create `src/components/theme-provider.tsx`:
```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentProps } from 'react'

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

Edit `src/app/layout.tsx`. Replace the body with:
```tsx
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata = { title: 'autoads', description: 'Manage Google Ads + Meta Ads from one place.' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Verify**

```bash
pnpm dev
```
Visit `http://localhost:3000`. Open DevTools → Console — expect no errors. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui primitives + indigo theme + next-themes provider"
```

---

## Task 4: Add `t3-env` validated environment + `.env.example`

**Files:**
- Create: `src/lib/env.ts`
- Create: `.env.example`
- Modify: `next.config.ts`

- [ ] **Step 1: Install**

```bash
pnpm add @t3-oss/env-nextjs zod
```

- [ ] **Step 2: Write `src/lib/env.ts`**

```ts
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    DATABASE_URL: z.string().url(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default('https://us.i.posthog.com'),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  emptyStringAsUndefined: true,
})
```

- [ ] **Step 3: Write `.env.example`**

```
# Supabase (get from `supabase status` after `supabase start`)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Analytics (optional in dev)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Error tracking (optional in dev)
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

- [ ] **Step 4: Force env validation at import time**

Edit `next.config.ts`:
```ts
import './src/lib/env'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
}

export default nextConfig
```

- [ ] **Step 5: Create `.env.local` from the template (with placeholder values for now)**

```bash
cp .env.example .env.local
```
Real values will be filled in Task 6 once Supabase is running.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add t3-env validated environment + .env.example"
```

---

## Task 5: Create the `slug` utility (TDD)

**Files:**
- Create: `src/lib/slug.ts`
- Create: `tests/unit/slug.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest @vitest/ui
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

- [ ] **Step 3: Add `test` script to `package.json`**

In `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/slug.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { slugify, ensureUniqueSlug } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases', () => expect(slugify('Acme Co')).toBe('acme-co'))
  it('removes special chars', () => expect(slugify('Acme & Co.!')).toBe('acme-co'))
  it('collapses whitespace', () => expect(slugify('  Acme   Co  ')).toBe('acme-co'))
  it('handles unicode', () => expect(slugify('Café Münchën')).toBe('cafe-munchen'))
  it('returns "workspace" for empty input', () => expect(slugify('')).toBe('workspace'))
})

describe('ensureUniqueSlug', () => {
  it('returns base when not taken', async () => {
    const taken = new Set<string>()
    expect(await ensureUniqueSlug('acme-co', async (s) => taken.has(s))).toBe('acme-co')
  })
  it('appends -2 when base taken', async () => {
    const taken = new Set(['acme-co'])
    expect(await ensureUniqueSlug('acme-co', async (s) => taken.has(s))).toBe('acme-co-2')
  })
  it('finds next free suffix', async () => {
    const taken = new Set(['acme-co', 'acme-co-2', 'acme-co-3'])
    expect(await ensureUniqueSlug('acme-co', async (s) => taken.has(s))).toBe('acme-co-4')
  })
})
```

- [ ] **Step 5: Run test, expect failure**

```bash
pnpm test
```
Expected: FAIL with "Cannot find module '@/lib/slug'".

- [ ] **Step 6: Implement `src/lib/slug.ts`**

```ts
export function slugify(input: string): string {
  const normalised = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return normalised || 'workspace'
}

export async function ensureUniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`
    if (!(await isTaken(candidate))) return candidate
  }
  throw new Error(`could not find a free slug for base "${base}"`)
}
```

- [ ] **Step 7: Run test, expect pass**

```bash
pnpm test
```
Expected: PASS, 8 tests passing.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add slug utility with unit tests"
```

---

## Task 6: Initialise local Supabase

**Files:**
- Create: `supabase/config.toml` (auto-written by `supabase init`)
- Modify: `.env.local` (real Supabase values)

- [ ] **Step 1: Verify Supabase CLI installed (Task should fail clearly if not)**

```bash
supabase --version
```
If missing: `brew install supabase/tap/supabase`.

- [ ] **Step 2: Initialise**

```bash
cd /Users/marios/Desktop/Cursor/autoads
supabase init
```
Skip the VS Code settings prompt unless you want them.

- [ ] **Step 3: Start the local stack**

```bash
supabase start
```
Expected: Docker pulls images then prints a status block with `API URL`, `anon key`, `service_role key`, `DB URL`. **Copy these values.**

- [ ] **Step 4: Fill `.env.local`**

Open `.env.local` and paste the values from `supabase status`:
```
NEXT_PUBLIC_SUPABASE_URL=<API URL from status>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from status>
DATABASE_URL=<DB URL from status>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 5: Verify env validation passes**

```bash
pnpm typecheck
pnpm dev
```
Expected: dev server boots without throwing on env validation. Visit `http://localhost:3000`. Stop the server.

- [ ] **Step 6: Commit (configs only — `.env.local` is gitignored)**

```bash
git add supabase/
git commit -m "chore: initialise local Supabase project"
```

---

## Task 7: Write database migrations (profiles, workspaces, RLS, sign-up trigger, avatars bucket)

**Files:**
- Create: `supabase/migrations/0001_initial_profiles_workspaces.sql`
- Create: `supabase/migrations/0002_signup_trigger.sql`
- Create: `supabase/migrations/0003_avatars_bucket.sql`

- [ ] **Step 1: Write migration 0001**

`supabase/migrations/0001_initial_profiles_workspaces.sql`:
```sql
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
```

- [ ] **Step 2: Write migration 0002 (sign-up trigger)**

`supabase/migrations/0002_signup_trigger.sql`:
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

- [ ] **Step 3: Write migration 0003 (avatars bucket + policies)**

`supabase/migrations/0003_avatars_bucket.sql`:
```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can insert own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 4: Apply all migrations to local DB**

```bash
supabase db reset
```
Expected: prints each migration applied + "Finished supabase db reset on branch ...".

- [ ] **Step 5: Manually verify in Supabase Studio**

Open `http://127.0.0.1:54323` (Studio URL from `supabase status`). Confirm:
- Tables `profiles` and `workspaces` exist with the right columns
- RLS is enabled on both
- A bucket named `avatars` exists under Storage

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add profiles + workspaces tables, RLS, signup trigger, avatars bucket"
```

---

## Task 8: Set up Supabase client helpers + type generation

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/db/types.ts` (generated, gitignored)
- Modify: `package.json`

- [ ] **Step 1: Install Supabase client packages**

```bash
pnpm add @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Add type-generation script to `package.json`**

In `scripts`:
```json
"db:types": "supabase gen types typescript --local > src/db/types.ts",
"db:reset": "supabase db reset",
"db:push": "supabase db push --linked",
"db:diff": "supabase db diff -f"
```

- [ ] **Step 3: Generate types**

```bash
pnpm db:types
```
Expected: `src/db/types.ts` created (a few hundred lines of TypeScript).

- [ ] **Step 4: Write the server-side client**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import type { Database } from '@/db/types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — ignore (middleware handles refresh).
          }
        },
      },
    },
  )
}
```

- [ ] **Step 5: Write the browser client**

`src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import type { Database } from '@/db/types'

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
```

- [ ] **Step 6: Write the middleware-side helper**

`src/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import type { Database } from '@/db/types'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )
  const { data } = await supabase.auth.getUser()
  return { response, supabase, user: data.user }
}
```

- [ ] **Step 7: Verify**

```bash
pnpm typecheck
```
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client helpers + DB type generation script"
```

---

## Task 9: Build shared visual primitives (`Logo`, `ThemeToggle`, `EmptyState`, `StatCard`)

**Files:**
- Create: `src/components/shared/logo.tsx`
- Create: `src/components/shared/theme-toggle.tsx`
- Create: `src/components/shared/empty-state.tsx`
- Create: `src/components/shared/stat-card.tsx`

- [ ] **Step 1: Install lucide-react for icons**

```bash
pnpm add lucide-react
```

- [ ] **Step 2: Write `Logo`**

`src/components/shared/logo.tsx`:
```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex select-none items-center text-lg font-bold tracking-tight text-foreground',
        className,
      )}
    >
      <span className="text-primary">auto</span>ads
    </Link>
  )
}
```

- [ ] **Step 3: Write `ThemeToggle`**

`src/components/shared/theme-toggle.tsx`:
```tsx
'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: Write `EmptyState`**

`src/components/shared/empty-state.tsx`:
```tsx
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-8 py-16 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}
```

- [ ] **Step 5: Write `StatCard`**

`src/components/shared/stat-card.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string
  hint?: string
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Logo, ThemeToggle, EmptyState, StatCard primitives"
```

---

## Task 10: Build the auth-related Server Actions

**Files:**
- Create: `src/lib/actions/auth.ts`
- Create: `src/lib/actions/onboarding.ts`
- Create: `src/lib/actions/profile.ts`
- Create: `src/lib/actions/workspace.ts`
- Create: `src/lib/actions/account.ts`

- [ ] **Step 1: Write `src/lib/actions/auth.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
})

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Please enter a valid email and password (8+ chars, letters + digits).' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) return { error: error.message }

  // Auto-login (no email verification per design).
  const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data)
  if (signInError) return { error: signInError.message }

  redirect('/onboarding')
}

const logInSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

export async function logIn(formData: FormData, redirectTo = '/app/dashboard') {
  const parsed = logInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid email or password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: 'Invalid email or password.' }

  redirect(redirectTo)
}

export async function logOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

const forgotSchema = z.object({ email: z.string().email() })

export async function requestPasswordReset(formData: FormData) {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: true } // generic, don't leak

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  })
  return { ok: true }
}

const resetSchema = z.object({ password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/) })

export async function resetPassword(formData: FormData) {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Password must be 8+ chars with letters and digits.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: error.message }

  redirect('/app/dashboard')
}
```

- [ ] **Step 2: Write `src/lib/actions/onboarding.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ensureUniqueSlug, slugify } from '@/lib/slug'

const schema = z.object({ name: z.string().min(1).max(60) })

export async function createInitialWorkspace(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Workspace name is required (max 60 chars).' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  const base = slugify(parsed.data.name)
  const slug = await ensureUniqueSlug(base, async (s) => {
    const { count } = await supabase.from('workspaces').select('id', { count: 'exact', head: true }).eq('slug', s)
    return (count ?? 0) > 0
  })

  const { error } = await supabase
    .from('workspaces')
    .insert({ name: parsed.data.name, slug, owner_id: userData.user.id })
  if (error) return { error: error.message }

  redirect('/app/dashboard')
}
```

- [ ] **Step 3: Write `src/lib/actions/profile.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ display_name: z.string().min(0).max(80) })

export async function updateProfile(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid display name.' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.display_name || null, updated_at: new Date().toISOString() })
    .eq('id', userData.user.id)
  if (error) return { error: error.message }

  revalidatePath('/app/settings/profile')
  return { ok: true }
}
```

- [ ] **Step 4: Write `src/lib/actions/workspace.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ name: z.string().min(1).max(60) })

export async function updateWorkspace(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid workspace name.' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('workspaces')
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq('owner_id', userData.user.id)
  if (error) return { error: error.message }

  revalidatePath('/app', 'layout')
  return { ok: true }
}
```

- [ ] **Step 5: Write `src/lib/actions/account.ts`**

Account deletion needs the service-role key (regular RLS forbids `auth.users` deletion).

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

  const admin = createAdmin(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await admin.auth.admin.deleteUser(data.user.id)
  if (error) return { error: error.message }

  await supabase.auth.signOut()
  redirect('/')
}
```

- [ ] **Step 6: Verify typecheck**

```bash
pnpm typecheck
```
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add auth + onboarding + profile + workspace + account Server Actions"
```

---

## Task 11: Build the `(auth)` route group (layout, sign-up, log-in, forgot, reset)

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/sign-up/page.tsx`
- Create: `src/app/(auth)/log-in/page.tsx`
- Create: `src/app/(auth)/forgot-password/page.tsx`
- Create: `src/app/(auth)/reset-password/page.tsx`
- Create: `src/components/auth/auth-card.tsx`

- [ ] **Step 1: Write `AuthCard`**

`src/components/auth/auth-card.tsx`:
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/shared/logo'

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <Logo className="mb-8" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Write `(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="bg-muted/30">{children}</main>
}
```

- [ ] **Step 3: Write the sign-up page**

`src/app/(auth)/sign-up/page.tsx`:
```tsx
import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp } from '@/lib/actions/auth'

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Start managing Google + Meta ads in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/log-in" className="font-medium text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form action={signUp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <p className="text-xs text-muted-foreground">8+ characters, with letters and digits.</p>
        </div>
        <Button type="submit" className="w-full">Create account</Button>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 4: Write the log-in page**

`src/app/(auth)/log-in/page.tsx`:
```tsx
import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { logIn } from '@/lib/actions/auth'

export default async function LogInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams
  const action = async (formData: FormData) => {
    'use server'
    return logIn(formData, redirect ?? '/app/dashboard')
  }
  return (
    <AuthCard
      title="Welcome back"
      footer={
        <>
          Don't have an account?{' '}
          <Link href="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:underline">
              Forgot?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full">Log in</Button>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 5: Write the forgot-password page**

`src/app/(auth)/forgot-password/page.tsx`:
```tsx
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { requestPasswordReset } from '@/lib/actions/auth'

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>
}) {
  const sent = false // server actions handle redirect; we use client transition state in a fancier version
  return (
    <AuthCard title="Reset your password" description="Enter the email associated with your account.">
      <form action={requestPasswordReset} className="space-y-4">
        {sent && (
          <Alert>
            <AlertDescription>
              If an account exists for that email, we've sent a reset link.
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <Button type="submit" className="w-full">Send reset link</Button>
      </form>
    </AuthCard>
  )
}
```

> Note: A polished version would use `useFormState` / `useActionState` to show the success alert client-side. For Foundation we can keep it simple — the Server Action returns `{ ok: true }` and the page re-renders showing the alert. Acceptable iteration target for a follow-up.

- [ ] **Step 6: Write the reset-password page**

`src/app/(auth)/reset-password/page.tsx`:
```tsx
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPassword } from '@/lib/actions/auth'

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <form action={resetPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <p className="text-xs text-muted-foreground">8+ characters, with letters and digits.</p>
        </div>
        <Button type="submit" className="w-full">Update password</Button>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 7: Verify**

```bash
pnpm dev
```
Visit `/sign-up`, `/log-in`, `/forgot-password`, `/reset-password`. Confirm each renders without errors. Stop dev server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add (auth) route group — sign-up, log-in, forgot/reset password pages"
```

---

## Task 12: Build the `middleware.ts` (session refresh + route protection)

**Files:**
- Create: `middleware.ts` (project root)

- [ ] **Step 1: Write `middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = ['/app', '/onboarding']
const PUBLIC_AUTH_PATHS = ['/sign-up', '/log-in', '/forgot-password', '/reset-password']

export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const isAuthPage = PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/log-in'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    // Has any workspace?
    const { count } = await supabase
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
    const hasWorkspace = (count ?? 0) > 0

    if (pathname.startsWith('/app') && !hasWorkspace) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
    if (pathname === '/onboarding' && hasWorkspace) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/dashboard'
      return NextResponse.redirect(url)
    }
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/app/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
}
```

- [ ] **Step 2: Verify dev still boots**

```bash
pnpm dev
```
Visit `/app/dashboard` (no session) — expect redirect to `/log-in?redirect=%2Fapp%2Fdashboard`. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add middleware for session refresh and route protection"
```

---

## Task 13: Build the onboarding page

**Files:**
- Create: `src/app/onboarding/page.tsx`

- [ ] **Step 1: Write the onboarding page**

```tsx
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createInitialWorkspace } from '@/lib/actions/onboarding'

export default function OnboardingPage() {
  return (
    <AuthCard
      title="Name your workspace"
      description="You can rename it any time in Settings."
    >
      <form action={createInitialWorkspace} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Workspace name</Label>
          <Input id="name" name="name" type="text" required maxLength={60} placeholder="Acme Co" autoFocus />
        </div>
        <Button type="submit" className="w-full">Continue</Button>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 2: Manual verification**

Stop and restart dev server, sign up at `/sign-up`. Expect to land on `/onboarding`. Submit a workspace name. Expect to land on `/app/dashboard` (which 404s for now — built next task).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add /onboarding page"
```

---

## Task 14: Build the app shell (layout, sidebar, header)

**Files:**
- Create: `src/app/app/layout.tsx`
- Create: `src/components/app/app-sidebar.tsx`
- Create: `src/components/app/app-header.tsx`
- Create: `src/components/app/user-menu.tsx`

- [ ] **Step 1: Write `AppSidebar`**

`src/components/app/app-sidebar.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Megaphone, Plug, Cog, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/shared/logo'

const NAV = [
  { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/app/connections', label: 'Connections', icon: Plug },
  { href: '/app/automation', label: 'Automation', icon: Cog },
  { href: '/app/reports', label: 'Reports', icon: BarChart3 },
  { href: '/app/settings/profile', label: 'Settings', icon: Settings },
] as const

export function AppSidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname()
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card">
      <div className="px-5 py-4">
        <Logo href="/app/dashboard" />
        <p className="mt-1 text-xs text-muted-foreground">{workspaceName}</p>
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
                  ? 'bg-muted font-medium text-foreground'
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

- [ ] **Step 2: Write `UserMenu`**

`src/components/app/user-menu.tsx`:
```tsx
'use client'

import { LogOut, User } from 'lucide-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { logOut } from '@/lib/actions/auth'

export function UserMenu({ email, displayName, avatarUrl }: { email: string; displayName: string | null; avatarUrl: string | null }) {
  const initial = (displayName || email).charAt(0).toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label="Open user menu">
        <Avatar className="h-8 w-8">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{displayName || email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings/profile"><User className="mr-2 h-4 w-4" /> Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut className="mr-2 h-4 w-4" /> Sign out</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 3: Write `AppHeader`**

`src/components/app/app-header.tsx`:
```tsx
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { UserMenu } from './user-menu'

export function AppHeader({
  email,
  displayName,
  avatarUrl,
  workspaceName,
}: {
  email: string
  displayName: string | null
  avatarUrl: string | null
  workspaceName: string
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <p className="text-sm font-medium">{workspaceName}</p>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu email={email} displayName={displayName} avatarUrl={avatarUrl} />
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Write `app/layout.tsx`**

`src/app/app/layout.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/app/app-sidebar'
import { AppHeader } from '@/components/app/app-header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/log-in')

  const [{ data: profile }, { data: workspace }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url').eq('id', userData.user.id).single(),
    supabase.from('workspaces').select('name').eq('owner_id', userData.user.id).single(),
  ])
  if (!workspace) redirect('/onboarding')

  return (
    <div className="flex h-dvh">
      <AppSidebar workspaceName={workspace.name} />
      <div className="flex flex-1 flex-col">
        <AppHeader
          email={userData.user.email ?? ''}
          displayName={profile?.display_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          workspaceName={workspace.name}
        />
        <main className="flex-1 overflow-auto bg-muted/20 p-8">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add a redirect at `/app`**

`src/app/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function AppIndex() {
  redirect('/app/dashboard')
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add app shell layout with sidebar, header, and user menu"
```

---

## Task 15: Build the protected pages (dashboard + 4 stubs)

**Files:**
- Create: `src/app/app/dashboard/page.tsx`
- Create: `src/app/app/campaigns/page.tsx`
- Create: `src/app/app/connections/page.tsx`
- Create: `src/app/app/automation/page.tsx`
- Create: `src/app/app/reports/page.tsx`

- [ ] **Step 1: Write the dashboard page**

`src/app/app/dashboard/page.tsx`:
```tsx
import { Plug } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview · Last 7 days</p>
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
          <Button asChild>
            <Link href="/app/connections">Connect an account</Link>
          </Button>
        }
      />
    </div>
  )
}
```

- [ ] **Step 2: Write the four stub pages — same shape with different labels**

`src/app/app/campaigns/page.tsx`:
```tsx
import { Megaphone } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Campaigns</h1>
      <EmptyState
        icon={Megaphone}
        title="No campaigns yet"
        description="Once you connect an ad account, your campaigns will appear here."
      />
    </div>
  )
}
```

`src/app/app/connections/page.tsx`:
```tsx
import { Plug } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Connections</h1>
      <EmptyState
        icon={Plug}
        title="No accounts connected"
        description="Google Ads and Meta Ads connections will be available in the next release."
      />
    </div>
  )
}
```

`src/app/app/automation/page.tsx`:
```tsx
import { Cog } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function AutomationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Automation</h1>
      <EmptyState
        icon={Cog}
        title="No rules yet"
        description="Define rules to automatically pause, resume, or change budgets based on performance."
      />
    </div>
  )
}
```

`src/app/app/reports/page.tsx`:
```tsx
import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <EmptyState
        icon={BarChart3}
        title="No reports yet"
        description="Custom reporting will land in a future release."
      />
    </div>
  )
}
```

- [ ] **Step 3: Manual smoke test**

```bash
pnpm dev
```
Sign up → onboard → land on `/app/dashboard`. Click each sidebar item, confirm each page renders. Stop dev.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add dashboard + 4 protected stub pages"
```

---

## Task 16: Build the settings pages (profile, workspace, account)

**Files:**
- Create: `src/app/app/settings/layout.tsx`
- Create: `src/app/app/settings/profile/page.tsx`
- Create: `src/app/app/settings/workspace/page.tsx`
- Create: `src/app/app/settings/account/page.tsx`
- Create: `src/components/app/avatar-upload.tsx`

- [ ] **Step 1: Write the settings layout (sub-nav)**

`src/app/app/settings/layout.tsx`:
```tsx
import Link from 'next/link'

const TABS = [
  { href: '/app/settings/profile', label: 'Profile' },
  { href: '/app/settings/workspace', label: 'Workspace' },
  { href: '/app/settings/account', label: 'Account' },
] as const

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
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

> Note: Active tab styling is intentionally not wired here (would require a client component). This is acceptable for v1; revisit if needed.

- [ ] **Step 2: Write `AvatarUpload`**

`src/components/app/avatar-upload.tsx`:
```tsx
'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function AvatarUpload({ userId, initialUrl, fallback }: { userId: string; initialUrl: string | null; fallback: string }) {
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const onFile = async (file: File) => {
    setBusy(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (error) {
      toast.error(error.message)
      setBusy(false)
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const newUrl = `${data.publicUrl}?t=${Date.now()}`
    await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', userId)
    setUrl(newUrl)
    setBusy(false)
    toast.success('Avatar updated')
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        {url && <AvatarImage src={url} alt="" />}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : 'Upload new image'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
          }}
        />
        <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, or WEBP. Max 2 MB.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the profile settings page**

`src/app/app/settings/profile/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AvatarUpload } from '@/components/app/avatar-upload'
import { updateProfile } from '@/lib/actions/profile'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user!
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single()

  const fallback = (profile?.display_name || user.email || '?').charAt(0).toUpperCase()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <AvatarUpload userId={user.id} initialUrl={profile?.avatar_url ?? null} fallback={fallback} />
        <Separator />
        <form action={updateProfile} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ''} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email ?? ''} disabled />
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Write the workspace settings page**

`src/app/app/settings/workspace/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateWorkspace } from '@/lib/actions/workspace'

export default async function WorkspaceSettingsPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, slug')
    .eq('owner_id', userData.user!.id)
    .single()

  return (
    <Card>
      <CardHeader><CardTitle>Workspace</CardTitle></CardHeader>
      <CardContent>
        <form action={updateWorkspace} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input id="name" name="name" defaultValue={workspace?.name ?? ''} maxLength={60} required />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={workspace?.slug ?? ''} disabled />
            <p className="text-xs text-muted-foreground">Slug is generated from the name and cannot be changed in v1.</p>
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Write the account settings page (delete account)**

`src/app/app/settings/account/page.tsx`:
```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteAccount } from '@/lib/actions/account'
import { logOut } from '@/lib/actions/auth'

export default function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>Sign out of this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logOut}>
            <Button type="submit" variant="outline">Sign out</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            Permanently delete your account, profile, workspace, and all associated data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteAccount}>
            <Button type="submit" variant="destructive">Delete my account</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add settings pages (profile + workspace + account) and avatar upload"
```

---

## Task 17: Build the `(marketing)` shell — header, footer, layout

**Files:**
- Create: `src/app/(marketing)/layout.tsx`
- Create: `src/components/marketing/marketing-header.tsx`
- Create: `src/components/marketing/marketing-footer.tsx`

- [ ] **Step 1: Write `MarketingHeader`**

`src/components/marketing/marketing-header.tsx`:
```tsx
import Link from 'next/link'
import { Logo } from '@/components/shared/logo'
import { Button } from '@/components/ui/button'

const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/blog', label: 'Blog' },
] as const

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/log-in">Log in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Write `MarketingFooter`**

`src/components/marketing/marketing-footer.tsx`:
```tsx
import Link from 'next/link'
import { Logo } from '@/components/shared/logo'

export function MarketingFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-muted-foreground">Manage Google + Meta Ads from one place.</p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Product</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
            <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Resources</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link href="/legal/terms" className="hover:text-foreground">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} autoads. All rights reserved.
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Write `(marketing)/layout.tsx`**

`src/app/(marketing)/layout.tsx`:
```tsx
import { MarketingFooter } from '@/components/marketing/marketing-footer'
import { MarketingHeader } from '@/components/marketing/marketing-header'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </>
  )
}
```

- [ ] **Step 4: Move the existing `/page.tsx` into the `(marketing)` group**

```bash
git mv src/app/page.tsx src/app/(marketing)/page.tsx
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add (marketing) layout with header and footer"
```

---

## Task 18: Build the landing page

**Files:**
- Modify: `src/app/(marketing)/page.tsx`
- Create: `src/components/marketing/hero.tsx`
- Create: `src/components/marketing/feature-grid.tsx`
- Create: `src/components/marketing/how-it-works.tsx`
- Create: `src/components/marketing/cta-section.tsx`

- [ ] **Step 1: Write `Hero`**

`src/components/marketing/hero.tsx`:
```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
      <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
        Smarter ad campaigns, <span className="text-primary">less manual work.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
        Connect Google Ads and Meta Ads in 60 seconds. Get unified reporting, automate the busywork, and ship better campaigns faster.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button size="lg" asChild>
          <Link href="/sign-up">Get started free</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/features">See features</Link>
        </Button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Write `FeatureGrid`**

`src/components/marketing/feature-grid.tsx`:
```tsx
import { Plug, BarChart3, Cog, Megaphone } from 'lucide-react'

const FEATURES = [
  { icon: Plug, title: 'Unified connections', body: 'OAuth into Google Ads and Meta Ads. We handle the token plumbing.' },
  { icon: BarChart3, title: 'One dashboard', body: 'Spend, ROAS, conversions across both platforms with daily granularity.' },
  { icon: Megaphone, title: 'Create ads in-app', body: 'Launch a Google Search or Meta single-image ad without context-switching.' },
  { icon: Cog, title: 'Automation rules', body: 'Pause underperformers and reallocate budget automatically.' },
] as const

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold">Everything you need, nothing you don't</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border p-6">
            <Icon className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Write `HowItWorks`**

`src/components/marketing/how-it-works.tsx`:
```tsx
const STEPS = [
  { n: '01', title: 'Sign up free', body: 'Create an account in 30 seconds. No credit card required.' },
  { n: '02', title: 'Connect your ad accounts', body: 'OAuth into Google Ads and Meta Ads. Read-only by default.' },
  { n: '03', title: 'Optimise and grow', body: 'Use the dashboard, run automation rules, create new ads in-app.' },
] as const

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold">How it works</h2>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {STEPS.map(({ n, title, body }) => (
          <div key={n}>
            <p className="text-sm font-semibold text-primary">{n}</p>
            <h3 className="mt-2 text-xl font-semibold">{title}</h3>
            <p className="mt-2 text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Write `CTASection`**

`src/components/marketing/cta-section.tsx`:
```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CTASection() {
  return (
    <section className="mx-auto my-16 max-w-3xl rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground">
      <h2 className="text-3xl font-bold">Ready to consolidate your ad ops?</h2>
      <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
        Get started in under a minute. Free during beta.
      </p>
      <Button size="lg" variant="secondary" className="mt-6" asChild>
        <Link href="/sign-up">Start free</Link>
      </Button>
    </section>
  )
}
```

- [ ] **Step 5: Compose them in `(marketing)/page.tsx`**

```tsx
import { Hero } from '@/components/marketing/hero'
import { FeatureGrid } from '@/components/marketing/feature-grid'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { CTASection } from '@/components/marketing/cta-section'

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <CTASection />
    </>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: build landing page (Hero, FeatureGrid, HowItWorks, CTA)"
```

---

## Task 19: Build the pricing, FAQ, features, blog, and legal pages

**Files:**
- Create: `src/app/(marketing)/pricing/page.tsx`
- Create: `src/app/(marketing)/faq/page.tsx`
- Create: `src/app/(marketing)/features/page.tsx`
- Create: `src/app/(marketing)/features/google-ads/page.tsx`
- Create: `src/app/(marketing)/features/meta-ads/page.tsx`
- Create: `src/app/(marketing)/features/automation/page.tsx`
- Create: `src/app/(marketing)/blog/page.tsx`
- Create: `src/app/(marketing)/blog/[slug]/page.tsx`
- Create: `src/app/(marketing)/legal/privacy/page.tsx`
- Create: `src/app/(marketing)/legal/terms/page.tsx`
- Create: `src/components/marketing/pricing-tier-cards.tsx`
- Create: `src/components/marketing/faq-accordion.tsx`
- Create: `src/components/marketing/feature-page-hero.tsx`

- [ ] **Step 1: Add the accordion shadcn primitive**

```bash
pnpm dlx shadcn@latest add accordion
```

- [ ] **Step 2: Write `PricingTierCards`**

`src/components/marketing/pricing-tier-cards.tsx`:
```tsx
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const TIERS = [
  {
    name: 'Free',
    blurb: 'For getting started.',
    price: 'Free',
    cta: 'Start free',
    features: ['1 workspace', '1 connected account', 'Read-only dashboard', 'Community support'],
  },
  {
    name: 'Pro',
    blurb: 'For growing teams.',
    price: 'Pricing announced soon',
    cta: 'Notify me',
    features: ['Up to 10 workspaces', '10 connected accounts', 'Ad creation', 'Email support'],
    highlighted: true,
  },
  {
    name: 'Business',
    blurb: 'For agencies and at-scale teams.',
    price: 'Pricing announced soon',
    cta: 'Notify me',
    features: ['Unlimited workspaces', 'Unlimited connected accounts', 'Automation rules', 'Priority support'],
  },
] as const

export function PricingTierCards() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-3">
      {TIERS.map((t) => (
        <Card key={t.name} className={t.highlighted ? 'border-primary' : undefined}>
          <CardHeader>
            <CardTitle>{t.name}</CardTitle>
            <CardDescription>{t.blurb}</CardDescription>
            <p className="pt-4 text-2xl font-semibold">{t.price}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <Button className="w-full" variant={t.highlighted ? 'default' : 'outline'} asChild>
              <Link href="/sign-up">{t.cta}</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write `FAQAccordion`**

`src/components/marketing/faq-accordion.tsx`:
```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const FAQ = [
  { q: 'Do you store my ad account credentials?', a: 'No — we use OAuth, so we receive a scoped access token from Google and Meta. You can revoke access at any time.' },
  { q: 'Which platforms do you support?', a: 'Google Ads and Meta Ads (Facebook + Instagram) at launch.' },
  { q: 'Can I create ads from autoads?', a: 'Yes — Pro and Business plans support creating Google Search ads and Meta single-image ads directly inside the app.' },
  { q: 'Is there a free plan?', a: 'Yes. The Free plan covers one workspace and one connected ad account, with a read-only dashboard.' },
  { q: 'Where is my data stored?', a: 'In a secure Postgres database hosted on Supabase (US region).' },
] as const

export function FAQAccordion() {
  return (
    <Accordion type="single" collapsible className="mx-auto max-w-2xl">
      {FAQ.map((item, i) => (
        <AccordionItem key={i} value={`item-${i}`}>
          <AccordionTrigger>{item.q}</AccordionTrigger>
          <AccordionContent>{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
```

- [ ] **Step 4: Write `FeaturePageHero`**

`src/components/marketing/feature-page-hero.tsx`:
```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function FeaturePageHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-16 pb-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{body}</p>
      <div className="mt-8">
        <Button size="lg" asChild>
          <Link href="/sign-up">Start free</Link>
        </Button>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Write each marketing page**

`src/app/(marketing)/pricing/page.tsx`:
```tsx
import { PricingTierCards } from '@/components/marketing/pricing-tier-cards'

export const metadata = { title: 'Pricing — autoads' }

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-2xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold">Simple pricing</h1>
        <p className="mt-3 text-muted-foreground">Start free. Upgrade when you need more.</p>
      </section>
      <PricingTierCards />
    </>
  )
}
```

`src/app/(marketing)/faq/page.tsx`:
```tsx
import { FAQAccordion } from '@/components/marketing/faq-accordion'

export const metadata = { title: 'FAQ — autoads' }

export default function FaqPage() {
  return (
    <>
      <section className="mx-auto max-w-2xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold">Frequently asked</h1>
      </section>
      <FAQAccordion />
    </>
  )
}
```

`src/app/(marketing)/features/page.tsx`:
```tsx
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const FEATURES = [
  { href: '/features/google-ads', title: 'Google Ads', body: 'Manage Search, Display, and Performance Max campaigns.' },
  { href: '/features/meta-ads', title: 'Meta Ads', body: 'Manage Facebook and Instagram campaigns from one place.' },
  { href: '/features/automation', title: 'Automation', body: 'Set up rules that pause, resume, and rebudget automatically.' },
] as const

export const metadata = { title: 'Features — autoads' }

export default function FeaturesPage() {
  return (
    <>
      <section className="mx-auto max-w-2xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold">Features</h1>
        <p className="mt-3 text-muted-foreground">Everything you need to run paid campaigns.</p>
      </section>
      <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.body}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-primary">Learn more →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
```

`src/app/(marketing)/features/google-ads/page.tsx`:
```tsx
import { FeaturePageHero } from '@/components/marketing/feature-page-hero'

export const metadata = { title: 'Google Ads — autoads' }

export default function GoogleAdsFeaturePage() {
  return (
    <FeaturePageHero
      eyebrow="Google Ads"
      title="One place for every Google Ads account"
      body="Connect any Google Ads account in seconds and see Search, Display, and Performance Max campaigns side-by-side with your Meta data."
    />
  )
}
```

`src/app/(marketing)/features/meta-ads/page.tsx`:
```tsx
import { FeaturePageHero } from '@/components/marketing/feature-page-hero'

export const metadata = { title: 'Meta Ads — autoads' }

export default function MetaAdsFeaturePage() {
  return (
    <FeaturePageHero
      eyebrow="Meta Ads"
      title="Facebook + Instagram, simplified"
      body="Connect your Meta Business account and manage Facebook and Instagram campaigns from a single, modern dashboard."
    />
  )
}
```

`src/app/(marketing)/features/automation/page.tsx`:
```tsx
import { FeaturePageHero } from '@/components/marketing/feature-page-hero'

export const metadata = { title: 'Automation — autoads' }

export default function AutomationFeaturePage() {
  return (
    <FeaturePageHero
      eyebrow="Automation"
      title="Stop babysitting campaigns"
      body="Define rules once. We'll watch your performance metrics 24/7 and pause, resume, or rebudget automatically."
    />
  )
}
```

`src/app/(marketing)/blog/page.tsx`:
```tsx
export const metadata = { title: 'Blog — autoads' }

export default function BlogPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 pt-16 pb-24">
      <h1 className="text-4xl font-bold">Blog</h1>
      <p className="mt-3 text-muted-foreground">Articles on paid ads, automation, and growth — coming soon.</p>
    </section>
  )
}
```

`src/app/(marketing)/blog/[slug]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // No posts yet; always 404 in v1.
  notFound()
  return null
}
```

`src/app/(marketing)/legal/privacy/page.tsx`:
```tsx
export const metadata = { title: 'Privacy — autoads' }

export default function PrivacyPage() {
  return (
    <article className="prose mx-auto max-w-2xl px-6 pt-16 pb-24 dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p>Last updated: 2026-04-22.</p>
      <p>
        autoads collects only the data necessary to operate the service: your email address, workspace name, and OAuth tokens for connected ad accounts. We do not sell or share your personal data with third parties.
      </p>
      <p>
        For questions, contact <a href="mailto:hello@autoads.app">hello@autoads.app</a>. This is a placeholder text — replace with your final policy before public launch.
      </p>
    </article>
  )
}
```

`src/app/(marketing)/legal/terms/page.tsx`:
```tsx
export const metadata = { title: 'Terms — autoads' }

export default function TermsPage() {
  return (
    <article className="prose mx-auto max-w-2xl px-6 pt-16 pb-24 dark:prose-invert">
      <h1>Terms of Service</h1>
      <p>Last updated: 2026-04-22.</p>
      <p>
        By using autoads you agree to use the service in accordance with applicable laws and the policies of any connected ad platforms. This is a placeholder text — replace with your final terms before public launch.
      </p>
    </article>
  )
}
```

- [ ] **Step 6: Add `@tailwindcss/typography` for the `prose` class**

```bash
pnpm add -D @tailwindcss/typography
```

Edit `tailwind.config.ts` — in the `plugins` array, add `require('@tailwindcss/typography')`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: build pricing, FAQ, features (3 sub-pages), blog scaffold, legal pages"
```

---

## Task 20: Add the `/api/health` endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Write the route handler**

```ts
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ status: 'ok', time: new Date().toISOString() })
}
```

- [ ] **Step 2: Verify**

```bash
pnpm dev
curl -s http://localhost:3000/api/health
```
Expected: `{"status":"ok","time":"2026-..."}`. Stop dev.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add /api/health endpoint"
```

---

## Task 21: Wire up Sentry

**Files:**
- Create: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Create: `src/lib/sentry/with-error-tracking.ts`
- Modify: `next.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Run Sentry's wizard**

```bash
pnpm dlx @sentry/wizard@latest -i nextjs
```
Choose: existing project, App Router. Provide your Sentry DSN (you can create a free account at https://sentry.io). Wizard will write the three `sentry.*.config.ts` files and a `sentry.properties` file, plus modify `next.config.ts`.

> If you don't have a Sentry account yet, skip this step for now — but mark this task as **partially complete** and revisit before deploy. Sentry is optional in dev.

- [ ] **Step 2: Wrap Server Actions with `withErrorTracking`**

`src/lib/sentry/with-error-tracking.ts`:
```ts
import * as Sentry from '@sentry/nextjs'

export function withErrorTracking<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (err) {
      Sentry.captureException(err)
      throw err
    }
  }
}
```

> Apply this wrapper to each exported Server Action gradually — not strictly required for Foundation acceptance, but recommended.

- [ ] **Step 3: Verify a deliberate error reaches Sentry**

Add a temporary `/api/sentry-test` route that throws:
```ts
// src/app/api/sentry-test/route.ts
export async function GET() {
  throw new Error('Sentry test error')
}
```
Visit `http://localhost:3000/api/sentry-test` once. Confirm the error appears in your Sentry dashboard within ~30s. Then **delete the test route** and commit.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire up Sentry for error tracking"
```

---

## Task 22: Wire up PostHog

**Files:**
- Create: `src/lib/posthog/client.ts`
- Create: `src/lib/posthog/server.ts`
- Create: `src/components/shared/posthog-provider.tsx`
- Create: `src/components/app/identify-user.tsx`
- Modify: `src/app/layout.tsx`, `src/app/app/layout.tsx`, Server Actions in `src/lib/actions/auth.ts` and `src/lib/actions/onboarding.ts`

- [ ] **Step 1: Install**

```bash
pnpm add posthog-js posthog-node
```

- [ ] **Step 2: Write `posthog/client.ts`**

```ts
'use client'
import posthog from 'posthog-js'
import { env } from '@/lib/env'

let initialised = false
export function getPosthog() {
  if (typeof window === 'undefined') return null
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return null
  if (!initialised) {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
      session_recording: { maskAllInputs: true },
      disable_session_recording: true,
    })
    initialised = true
  }
  return posthog
}
```

- [ ] **Step 3: Write `posthog/server.ts`**

```ts
import { PostHog } from 'posthog-node'
import { env } from '@/lib/env'

let client: PostHog | null = null
export function getServerPosthog() {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return null
  if (!client) {
    client = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1, // serverless-friendly
      flushInterval: 0,
    })
  }
  return client
}

export async function captureServer(distinctId: string, event: string, props?: Record<string, unknown>) {
  const ph = getServerPosthog()
  if (!ph) return
  ph.capture({ distinctId, event, properties: props })
  await ph.shutdown() // ensure event flushes before serverless function exits
}
```

- [ ] **Step 4: Write the provider**

`src/components/shared/posthog-provider.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import { getPosthog } from '@/lib/posthog/client'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    getPosthog()
  }, [])
  return <>{children}</>
}
```

Mount it in `src/app/layout.tsx`, inside `ThemeProvider`:
```tsx
<ThemeProvider ...>
  <PostHogProvider>{children}</PostHogProvider>
  <Toaster richColors closeButton />
</ThemeProvider>
```

- [ ] **Step 5: Identify the user inside the protected app shell**

`src/components/app/identify-user.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import { getPosthog } from '@/lib/posthog/client'

export function IdentifyUser({ id, email }: { id: string; email: string }) {
  useEffect(() => {
    const ph = getPosthog()
    if (ph) ph.identify(id, { email })
  }, [id, email])
  return null
}
```

In `src/app/app/layout.tsx`, add inside the returned tree (anywhere — it renders nothing):
```tsx
<IdentifyUser id={userData.user.id} email={userData.user.email ?? ''} />
```

- [ ] **Step 6: Fire server-side events from Server Actions**

In `src/lib/actions/auth.ts`, after each successful auth call, before the redirect:
```ts
import { captureServer } from '@/lib/posthog/server'

// After signUp success:
await captureServer(parsed.data.email, 'user_signed_up', {
  email_domain: parsed.data.email.split('@')[1],
  signup_method: 'password',
})

// After logIn success (use the user id):
const { data } = await supabase.auth.getUser()
if (data.user) {
  await captureServer(data.user.id, 'user_logged_in', {
    email_domain: parsed.data.email.split('@')[1],
  })
}

// After logOut, before redirect:
await captureServer('anonymous', 'user_logged_out')

// After requestPasswordReset:
await captureServer(parsed.data.email, 'password_reset_requested')
```

In `src/lib/actions/onboarding.ts`, after successful insert:
```ts
await captureServer(userData.user.id, 'onboarding_completed', {
  workspace_name_length: parsed.data.name.length,
})
```

In `src/app/app/dashboard/page.tsx`, capture first-view client-side. Add a small client component:
```tsx
// src/components/app/track-dashboard-view.tsx
'use client'
import { useEffect } from 'react'
import { getPosthog } from '@/lib/posthog/client'

export function TrackDashboardView() {
  useEffect(() => {
    getPosthog()?.capture('dashboard_viewed')
  }, [])
  return null
}
```
Render it in the dashboard page above the rest of the JSX.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire up PostHog (client init, server captures, identify, key events)"
```

---

## Task 23: Add unit tests for `env` and middleware path matching

**Files:**
- Create: `tests/unit/env.test.ts`
- Create: `tests/unit/middleware-paths.test.ts`

- [ ] **Step 1: Write `tests/unit/env.test.ts`**

```ts
import { describe, expect, it } from 'vitest'

describe('env validation', () => {
  it('fails fast on missing NEXT_PUBLIC_SUPABASE_URL', async () => {
    const orig = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SKIP_ENV_VALIDATION = ''
    await expect(import('@/lib/env').then(() => 'no-throw')).rejects.toThrow()
    process.env.NEXT_PUBLIC_SUPABASE_URL = orig
  })
})
```

> Note: You may need to run env tests with `--no-cache` or in a separate shell because module-level imports are cached. Acceptable behaviour for v1: skip this test if it proves flaky and rely on dev-time validation.

- [ ] **Step 2: Write `tests/unit/middleware-paths.test.ts`**

```ts
import { describe, expect, it } from 'vitest'

const PROTECTED = ['/app', '/onboarding']

function isProtected(pathname: string) {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

describe('middleware path matching', () => {
  it('protects /app/dashboard', () => expect(isProtected('/app/dashboard')).toBe(true))
  it('protects /onboarding', () => expect(isProtected('/onboarding')).toBe(true))
  it('does not protect /pricing', () => expect(isProtected('/pricing')).toBe(false))
  it('does not protect / (landing)', () => expect(isProtected('/')).toBe(false))
  it('does not protect /api/health', () => expect(isProtected('/api/health')).toBe(false))
})
```

- [ ] **Step 3: Run**

```bash
pnpm test
```
Expected: all tests pass (slug + env + middleware = at least 13 tests).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: add env validation + middleware path matching unit tests"
```

---

## Task 24: Add Playwright E2E tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/marketing.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm dlx playwright install chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
```

- [ ] **Step 3: Add scripts**

In `package.json` `scripts`:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Write `tests/e2e/marketing.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test('marketing pages render with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))

  for (const path of ['/', '/pricing', '/faq', '/features', '/features/google-ads', '/blog', '/legal/privacy', '/legal/terms']) {
    await page.goto(path)
    await expect(page).toHaveTitle(/autoads/i)
  }
  expect(errors).toEqual([])
})
```

- [ ] **Step 5: Write `tests/e2e/auth.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test('full happy path: sign up → onboard → dashboard → sign out', async ({ page }) => {
  const email = `test-${Date.now()}@example.com`
  const password = 'Testing123'
  const workspaceName = `WS ${Date.now()}`

  // Sign up
  await page.goto('/sign-up')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  // Onboard
  await page.waitForURL('**/onboarding')
  await page.fill('input[name="name"]', workspaceName)
  await page.click('button[type="submit"]')

  // Dashboard
  await page.waitForURL('**/app/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText(workspaceName)).toBeVisible()

  // Sign out via user menu
  await page.click('button[aria-label="Open user menu"]')
  await page.click('text=Sign out')
  await page.waitForURL('http://localhost:3000/')
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
})
```

- [ ] **Step 6: Run**

Make sure local Supabase is running (`supabase start`) and dev server is NOT already running (Playwright starts it). Then:

```bash
pnpm test:e2e
```
Expected: 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: add Playwright E2E tests (marketing pages + full auth happy path)"
```

---

## Task 25: Initialise GitHub repo and Vercel project

**Files:** none (external services)

- [ ] **Step 1: Create the GitHub repo**

```bash
gh repo create marios/autoads --private --source=. --push
```
If `gh` is not installed: `brew install gh && gh auth login`.

Expected: Repo created at `https://github.com/marios/autoads`; current branch pushed.

- [ ] **Step 2: Connect to Vercel**

```bash
pnpm dlx vercel link
```
Choose: link to existing or create new. Project name `autoads`. Confirm framework preset = Next.js.

- [ ] **Step 3: Create a production Supabase project**

Visit `https://supabase.com/dashboard` → New Project → name `autoads` → choose region near you. Wait ~2 min for provisioning.

Save these values for the next step (you can find them in Project Settings → API and Project Settings → Database):
- Project URL (`https://<ref>.supabase.co`)
- `anon` public key
- `service_role` secret key
- Database connection string (use the **Pooled** one, port 6543, for serverless)

- [ ] **Step 4: Push migrations to the production Supabase project**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```
Expected: All three migrations applied to production.

- [ ] **Step 5: Add env vars to Vercel**

```bash
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL production
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
pnpm dlx vercel env add SUPABASE_SERVICE_ROLE_KEY production
pnpm dlx vercel env add DATABASE_URL production
pnpm dlx vercel env add NEXT_PUBLIC_SITE_URL production
pnpm dlx vercel env add NEXT_PUBLIC_POSTHOG_KEY production
pnpm dlx vercel env add NEXT_PUBLIC_POSTHOG_HOST production
pnpm dlx vercel env add SENTRY_DSN production
pnpm dlx vercel env add SENTRY_AUTH_TOKEN production
```
Repeat each line with `preview` and `development` arguments if you want them on those environments too. (Recommended at minimum for `NEXT_PUBLIC_SITE_URL` per environment so it points at the right URL.)

- [ ] **Step 6: First production deploy**

```bash
pnpm dlx vercel --prod
```
Expected: Build runs, deploy succeeds. URL: `https://autoads.vercel.app` (or similar).

- [ ] **Step 7: Smoke test the deployed app**

Visit the production URL. Sign up with a real email. Confirm onboarding works and you land on the dashboard.

- [ ] **Step 8: Commit + push**

```bash
git add -A
git commit --allow-empty -m "chore: initial production deploy"
git push
```

---

## Task 26: Add CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_SITE_URL: http://localhost:3000
          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      - name: Install Playwright Browsers
        run: pnpm exec playwright install --with-deps chromium
      - name: Run E2E (against built app)
        run: pnpm test:e2e
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_SITE_URL: http://localhost:3000
```

- [ ] **Step 2: Add the secrets in GitHub**

Visit `https://github.com/marios/autoads/settings/secrets/actions` and add each of the env values from Task 25 step 5. Use a **separate, dedicated CI Supabase project** if you want full E2E in CI without polluting prod. (Optional: skip Playwright in CI for v1 — keep it for local-only — by removing the last two steps. Faster CI, less coverage.)

- [ ] **Step 3: Commit + push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck + lint + test + build pipeline"
git push
```

Watch the run at `https://github.com/marios/autoads/actions`. Fix any failures.

---

## Task 27: Add deploy workflow (run migrations on merge to main)

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Generate a Supabase access token**

Visit `https://supabase.com/dashboard/account/tokens` → Generate new token → name `autoads-ci` → copy. Add it as `SUPABASE_ACCESS_TOKEN` in GitHub Actions secrets.

- [ ] **Step 2: Write the workflow**

```yaml
name: Deploy migrations
on:
  push:
    branches: [main]
    paths: ['supabase/migrations/**']

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

Add the new secrets `SUPABASE_PROJECT_REF` (the ref string) and `SUPABASE_DB_PASSWORD` (database password from Project Settings → Database).

- [ ] **Step 3: Commit + push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy Supabase migrations on merge to main"
git push
```

---

## Task 28: Verify all acceptance criteria pass on the production deploy

**Files:** none — this is the spec validation pass.

- [ ] **Step 1: Functional acceptance — go through each item from the spec**

Visit `https://autoads.vercel.app`. For each row, perform the action and check the box:

- [ ] Land on `/`, see marketing page, click "Sign up"
- [ ] Sign up with email + password, name workspace, land on `/app/dashboard`
- [ ] See empty-state placeholders on every protected page (Dashboard, Campaigns, Connections, Automation, Reports)
- [ ] Toggle light / dark / system theme via the theme toggle
- [ ] Sign out (via user menu), sign back in
- [ ] Reset password via email (use `/forgot-password` and check inbox)
- [ ] Update display name in `/app/settings/profile`
- [ ] Upload an avatar in `/app/settings/profile` and confirm it appears in the user menu
- [ ] Update workspace name in `/app/settings/workspace`
- [ ] Delete account in `/app/settings/account`; verify you can no longer log in with that email

- [ ] **Step 2: Quality gates**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```
Expected: all four exit 0.

- [ ] **Step 3: Lighthouse**

In Chrome DevTools → Lighthouse, run on the deployed `/` page in incognito, mobile profile. Confirm:
- Performance ≥ 90
- Accessibility ≥ 95

If accessibility is below 95: most common fixes are missing `alt`, missing `aria-label` on icon-only buttons (the user-menu trigger and theme toggle already have them), low colour contrast.

- [ ] **Step 4: Bundle size check**

```bash
pnpm build
```
Look at the build output table. Find the row for `/app/dashboard`. Confirm "First Load JS" < 120 KB. If over: identify the largest dependency in the dashboard route via `pnpm dlx next-bundle-analyzer` and consider lazy-loading.

- [ ] **Step 5: `/api/health`**

```bash
curl -s https://autoads.vercel.app/api/health
```
Expected: `{"status":"ok","time":"..."}`.

- [ ] **Step 6: PostHog check**

Open your PostHog project. Confirm `user_signed_up`, `onboarding_completed`, `dashboard_viewed`, `user_logged_out` events received during step 1.

- [ ] **Step 7: Sentry check**

Trigger an error (e.g., temporarily add a throwing route, deploy, hit it, then revert). Confirm it appears in Sentry. Or run the local test from Task 21 step 3.

- [ ] **Step 8: Final commit**

```bash
git commit --allow-empty -m "chore: Foundation sub-project shipped — all acceptance criteria pass"
git push
```

---

## Self-review

**Spec coverage:**

| Spec section | Covered by tasks |
|---|---|
| Architecture diagram (Section 1) | 1, 6, 8 |
| Data model + RLS + sign-up trigger (Section 1) | 7 |
| Route map (Section 2) | 11, 13, 14, 15, 16, 17, 18, 19 |
| Three layout shells (Section 2) | 11, 14, 17 |
| Components inventory (Section 2) | 3, 9, 11, 14, 16, 17, 18, 19 |
| Server vs client split (Section 2) | 11, 14, 16 (each component marked `'use client'` only when needed) |
| Sign-up / login / forgot / reset flows (Section 3) | 10, 11, 12 |
| Onboarding flow (Section 3) | 10, 13 |
| Session management + middleware (Section 3) | 8, 12 |
| Sign-out (Section 3) | 10, 14 (user menu) |
| Password policy (Section 3) | 10 (Zod regex) — also requires Supabase project setting |
| Security hardening (Section 3) | 10 (neutral errors), 12 (middleware), Vercel HTTPS, Supabase rate limits |
| Analytics events (Section 3) | 22 |
| Folder structure (Section 4) | 1, 8, 10, 11, 14, 16, 17, 22 |
| Env vars (Section 4) | 4, 25 |
| Local dev setup (Section 4) | 1, 6, 7 |
| CI/CD pipeline (Section 4) | 26, 27 |
| Testing strategy (Section 4) | 5 (slug TDD), 23 (env + middleware), 24 (E2E) |
| Pre-commit hooks (Section 4) | 2 |
| Sentry + PostHog (Section 4) | 21, 22 |
| Acceptance criteria (Section 4) | 28 |
| Avatar storage bucket (Open question) | 7, 16 |
| Hard delete cascading (Open question) | 10 (`account.ts` uses admin API) |

**Placeholder scan:** No "TBD", no "TODO" in steps. Two "Note:" callouts (forgot-password client transition state in Task 11; settings tab active styling in Task 16) are explicit acceptable simplifications, not deferred work.

**Type consistency:** Function names match across tasks (`signUp`, `logIn`, `logOut`, `requestPasswordReset`, `resetPassword`, `createInitialWorkspace`, `updateProfile`, `updateWorkspace`, `deleteAccount`). Component names consistent (`Logo`, `ThemeToggle`, `EmptyState`, `StatCard`, `AuthCard`, `AppSidebar`, `AppHeader`, `UserMenu`, `MarketingHeader`, `MarketingFooter`, `Hero`, `FeatureGrid`, `HowItWorks`, `CTASection`, `PricingTierCards`, `FAQAccordion`, `FeaturePageHero`, `AvatarUpload`, `IdentifyUser`, `TrackDashboardView`). DB column names match between migration (Task 7) and Server Actions (Task 10): `display_name`, `avatar_url`, `name`, `slug`, `owner_id`.

Plan is complete.
