# ADSAT Staff Operations Platform (`asop`)

A private, mobile-first PWA built by **Christex Foundation** for **ADSAT Development Services**. It gives a small team (≤ 15 staff across multiple service lines) a single role-aware workspace to manage staff accounts, assign tasks, and submit structured activity reports — replacing the current mix of messaging apps, spreadsheets, and email.

This repository is private and not intended for general open-source consumption.

## Status

Active development. The codebase has progressed through Phases 1–8 of [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) (foundation → users/RBAC → tasks → reports → notifications → attachments → dashboards/search → PWA + offline-first report drafts). Phases 9–10 (audit/polish, pilot/launch) are still ahead.

Three documents are the source of truth — read them before non-trivial changes:

- [`PRD.md`](./PRD.md) — **what** to build: scope, roles, functional requirements (`FR-*` IDs), RBAC matrix, success metrics.
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — **how and in what order**: phases, the load-bearing PWA shell spec (§ 2), cross-cutting patterns (§ 3), file-tree shape (§ 6).
- [`CLAUDE.md`](./CLAUDE.md) — working-with-Claude conventions and the architectural rules the codebase reuses.

When the PRD and the plan conflict, the PRD wins for scope; the plan wins for structure/sequencing.

## Stack

| Concern       | Choice                                                                      |
| ------------- | --------------------------------------------------------------------------- |
| App framework | SvelteKit (Node adapter, Vercel) + Svelte 5 **runes mode** · TypeScript strict |
| UI            | Tailwind CSS v4 (via `@tailwindcss/vite`) · shadcn-svelte · lucide-svelte   |
| Auth          | Better Auth (Prisma adapter)                                                |
| Database      | Neon Postgres + Prisma (pooled URL for app, direct URL for migrations)      |
| Files         | Cloudinary (signed presets, browser → Cloudinary direct)                    |
| Email         | Resend (Svelte component templates) — `EMAIL_TRANSPORT=dev` logs to console |
| Push          | Web Push (VAPID, no SaaS)                                                   |
| Validation    | zod in every form action                                                    |
| Testing       | Vitest (unit). Playwright (E2E) planned per plan § 14.8, not yet wired.     |
| Hosting       | Vercel + Vercel Cron                                                        |

> The plan locks **pnpm** as the package manager, but the current lockfile is `package-lock.json` (npm). Don't switch unilaterally — confirm before migrating.

## Prerequisites

- Node.js 20+ (Vercel runs Node 24 LTS by default).
- A package manager — currently **npm** in this repo.
- A Neon Postgres project — you need both the **pooled** and **direct** connection strings.
- A Better Auth secret (`openssl rand -base64 32`).
- Optional for local dev: Cloudinary credentials (uploads) and a Resend API key. With `EMAIL_TRANSPORT=dev` the app prints email payloads to the terminal, so Resend is not required to develop locally.

## Setup

```sh
# 1. Install dependencies (postinstall runs `prisma generate`)
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET. Leave EMAIL_TRANSPORT=dev
# to log outbound mail to the terminal instead of calling Resend.

# 3. Apply migrations to your Neon database
npm run db:migrate

# 4. Start the dev server
npm run dev          # add ` -- --open` to launch a browser
```

See [`.env.example`](./.env.example) for the full list of variables and the inline comments explaining each.

## Scripts

| Script                  | What it does                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server.                                                                            |
| `npm run build`         | `prisma generate` + production Vite build.                                                  |
| `npm run preview`       | Serve the production build locally.                                                         |
| `npm run check`         | `svelte-kit sync` + `svelte-check` (TS + Svelte diagnostics).                               |
| `npm run check:watch`   | Same, watch mode.                                                                           |
| `npm run lint`          | `prettier --check` + ESLint.                                                                |
| `npm run format`        | `prettier --write` across the repo.                                                         |
| `npm run test`          | Run Vitest once.                                                                            |
| `npm run test:watch`    | Vitest in watch mode.                                                                       |
| `npm run test:ui`       | Vitest UI.                                                                                  |
| `npm run db:generate`   | Regenerate the Prisma client.                                                               |
| `npm run db:migrate`    | `prisma migrate dev` against `DIRECT_URL`.                                                  |
| `npm run db:push`       | `prisma db push` (schema sync without a migration — dev/throwaway DBs only).                |
| `npm run db:studio`     | Open Prisma Studio.                                                                         |
| `npm run auth:generate` | Regenerate Better Auth's Prisma schema to `/tmp/auth-schema.prisma` for hand-merging into `prisma/schema.prisma`. |

## Bootstrapping the first user

There is no public sign-up and no admin UI for inviting the very first account (admin invite UI lives in Phase 2 onward — for the bootstrap user it's still a script). Run:

```sh
npx tsx scripts/seed-invite.ts <email> [role=staff] [name...]
```

This creates the user with a throwaway random password and triggers Better Auth's password-reset flow against that account. With `EMAIL_TRANSPORT=dev` the accept-invite URL is logged to the terminal — paste it into a browser to set the first password and sign in. See the header comment in [`scripts/seed-invite.ts`](./scripts/seed-invite.ts) for details.

## Project layout

```
src/
  app.html
  hooks.server.ts         # resolves session → event.locals.user via Better Auth
  service-worker.ts       # runtime caching, /offline fallback, background sync
  lib/
    server/               # auth, rbac, audit, notify, actions, db, email, push, cloudinary, tasks, reports, dashboard, notifications
    components/           # ui (shadcn), shell, tasks, reports, staff, notifications, dashboard, forms
    client/               # IndexedDB draft store, submission queue, install-prompt
  routes/
    (public)/             # sign-in, forgot-password, reset-password, accept-invite
    (app)/                # authenticated shell — guard in +layout.server.ts
      admin/              # admin-only subtree — role gate in +layout.server.ts
      dashboard/  tasks/  reports/  staff/  templates/  notifications/  inbox/  profile/
    api/                  # auth, tasks, users, templates, attachments, uploads, search, notifications, push, cron
    offline/              # standalone offline fallback page
prisma/                   # schema.prisma + migrations
scripts/                  # seed-invite.ts
static/                   # manifest.webmanifest, icons, placeholder-logo.svg, robots.txt
vercel.json               # cron schedule
```

A fuller representative tree lives in `IMPLEMENTATION_PLAN.md` § 6.

## Conventions

The codebase reuses a small set of helpers — when you write a new feature, plug into them rather than introducing parallel patterns. See [`CLAUDE.md`](./CLAUDE.md) and `IMPLEMENTATION_PLAN.md` § 3 for the full rules.

- **Route groups**: `(public)/` for anonymous pages, `(app)/` for the authenticated shell. `(app)/+layout.server.ts` is the auth guard; `(app)/admin/+layout.server.ts` is the admin role gate. Both re-assert server-side.
- **Data flow**: every page reads via `+page.server.ts` `load`. Every mutation is a form action wrapped in `withAction(handler)` (`src/lib/server/actions.ts`) doing zod-parse → role/ownership check → Prisma transaction (write + audit + notify enqueue) → success or `fail(400, { issues })`.
- **RBAC**: `src/lib/server/rbac.ts` `can(user, action, resource)` is the single source of truth — used by server guards _and_ UI affordance rendering.
- **Audit**: `src/lib/server/audit.ts` `audit(...)` is called **inside the same Prisma transaction** as the mutation it logs.
- **Notifications**: `src/lib/server/notify.ts` writes the in-app row synchronously, then dispatches email/push asynchronously via `waitUntil`. Email/push failures are caught and logged — `notify` never throws out of the form action.
- **Uploads**: browser bypasses the app server. `POST /api/uploads/sign` → browser PUTs to Cloudinary → `POST /api/attachments` records `(ownerType, ownerId, public_id, secure_url)`. A single `<FileDropzone>` component owns the two-step dance.
- **Auth in components**: read `user` from `$page.data.user` — do not prop-drill.
- **No raw SQL** outside `src/lib/server/db/` helpers (`tsvector` search is the main expected exception).
- **Runes everywhere**: use `$state`, `$derived`, `$props`, `$effect`. Legacy `let`/`$:` reactivity is not allowed (runes mode is forced in `svelte.config.js`).
- **Style**: Prettier with tabs, single quotes, no trailing commas, 100-char print width. Run `npm run format` before committing.

## Testing

`npm run test` runs the Vitest unit suite — current coverage includes `audit`, `rbac`, `sanitize`, and a small server `smoke` test (see `src/lib/server/*.test.ts`). Playwright E2E on the critical flows (sign-in, assign task, submit report, request revision, PWA install) is planned per plan § 14.8 but not yet wired.

## Deployment

- Hosted on **Vercel** with the Node adapter — one production environment plus per-PR previews.
- Environment variables managed via `vercel env`; never commit secrets.
- `npm run build` runs `prisma generate`; **migrations are not applied at build time** — run `prisma migrate deploy` against the production direct URL separately.
- Scheduled jobs live in [`vercel.json`](./vercel.json): `/api/cron/daily-reminders` fires daily at `07:00` UTC (due-tomorrow and overdue task reminders).

## Out of scope (v1)

Per PRD § 4.2 the following are explicitly **not** in v1: native iOS/Android apps, time tracking, leave management, performance reviews, client portals, public report sharing, SSO, multi-tenant, third-party API, real-time chat, advanced BI. Flag any request touching these before implementing.
