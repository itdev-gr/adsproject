# autoads — Project Overview

**Date:** 2026-04-22
**Status:** Active. Foundation sub-project being designed first.

## What autoads is

A multi-tenant SaaS platform that lets users **manage and create paid ad campaigns** across **Google Ads** and **Meta Ads**, with **automation rules** for bid/budget optimisation. Public sign-up; mix of solos, in-house teams, and agencies.

## Stack (decided)

- **Frontend / framework:** Next.js 15 (App Router) + React 19 + TypeScript (strict)
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime)
- **Auth providers:** Email + password only at v1 (no third-party sign-in)
- **Type-safe DB access:** Supabase generated types + Drizzle ORM for complex queries
- **Background jobs:** Inngest (data sync, rule evaluation)
- **Ad platform SDKs:** `google-ads-api` (Node), `facebook-nodejs-business-sdk` (Node)
- **Forms:** React Hook Form + Zod
- **Charts:** Tremor (built on Recharts)
- **Tables:** TanStack Table
- **Payments:** Stripe (Checkout + Customer Portal + webhooks)
- **Email:** Resend + React Email
- **Error tracking:** Sentry
- **Product analytics:** PostHog
- **Hosting:** Vercel (Next.js) + Supabase cloud + Inngest cloud
- **Repo:** single Next.js app (no monorepo); GitHub `marios/autoads` private; pnpm

**Brand direction:** Friendly SaaS (Notion / Stripe-light vibe). Indigo-600 accent. Wordmark logo. Light + dark + system theme.

## Sub-project decomposition (build order)

Each sub-project gets its own design spec → implementation plan → execution cycle. Total estimate ~20 weeks solo full-time.

| # | Sub-project | What ships | Depends on | Effort (solo) |
|---|---|---|---|---|
| 1 | **Foundation** | Next.js app on Vercel, Supabase wired up, marketing site (landing/pricing/FAQ/blog scaffold/feature pages/legal), email-password auth, single-question onboarding (workspace name), authenticated app shell (classic sidebar) with empty-state placeholders for every section | — | ~1 week |
| 2 | **Workspaces & RBAC** | Multi-tenant data model, workspace creation/edit, team invites by email, roles (owner/admin/editor/viewer), workspace switcher, RLS isolation | 1 | ~1 week |
| 3 | **Ad-account connections** | Google Ads OAuth + Meta Ads OAuth (with refresh + revocation), connected-accounts list per workspace, status indicators | 1, 2 | ~2 weeks |
| 4 | **Data sync engine** | Inngest jobs pulling campaign / ad-set / ad / keyword performance from Google + Meta on schedule, time-series Postgres storage, backfill on first connection | 3 | ~3 weeks |
| 5 | **Dashboard & reporting** | Cross-platform dashboard (spend, impressions, clicks, conversions, CPA, ROAS), date-range picker, per-account drill-down, campaign-level table, charts | 4 | ~3 weeks |
| 6 | **Ad creation** | Multi-step wizard (Google Search ad + Meta single-image ad), push to platform via API, preview, draft / publish modes | 3 | ~4 weeks |
| 7 | **Automation rules engine** | Rule builder UI, Inngest evaluator, action log, pause/resume/budget actions on both platforms | 4, 6 | ~3 weeks |
| 8 | **Notifications** | Email (Resend) + in-app for rule firings, account disconnect, sync failures, weekly summary | 4 | ~1 week |
| 9 | **Billing** | Stripe Checkout + Customer Portal, three-tier plans (Free / Pro / Business), feature-gated by limits, webhook → Supabase | 1 | ~2 weeks |

**Recommended order:** `1 → 2 → 3 → 4 → 5 → (6 ‖ 7 ‖ 9) → 8`. After sub-project 5 the product is shippable as a read-only analytics tool.

## What is explicitly out of scope (forever or for now)

- Mobile native apps
- Self-hosted deployment
- Per-language i18n at v1 (English only)
- Ad platforms beyond Google + Meta in the MVP (TikTok / LinkedIn / X possible in a future phase)
- Public REST API for third-party developers
- AI-generated ad creative (interesting future work but not committed)
