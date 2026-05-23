# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

This repo is the **ADSAT Staff Operations Platform** (working name `asop`) — a private, mobile-first PWA being built by Christex Foundation for ADSAT Development Services. At the moment the codebase is a freshly scaffolded SvelteKit minimal template (TS strict + Tailwind v4 + ESLint + Prettier); essentially none of the product code exists yet.

The **source of truth** for what to build is split across two documents at the repo root — read both before making non-trivial changes:

- `PRD.md` — _what_ (v0.1, draft): scope, roles, functional requirements (`FR-*` IDs), tech-stack lock (§ 14), RBAC matrix (§ 12), cross-cutting patterns (§ 15), launch metrics (§ 18).
- `IMPLEMENTATION_PLAN.md` — _how and in what order_: build phases 1–10, the load-bearing PWA shell spec (§ 2), the architectural patterns to establish in Phase 1 and reuse forever (§ 3), and a representative file tree (§ 6).

When the PRD and the plan conflict, the PRD wins for scope; the plan wins for structure/sequencing.

## Commands

```bash
npm run dev          # vite dev (use -- --open to launch browser)
npm run build        # production build
npm run preview      # serve the production build locally
npm run check        # svelte-kit sync + svelte-check (TS + Svelte diagnostics)
npm run check:watch  # same in watch mode
npm run lint         # prettier --check . && eslint .
npm run format       # prettier --write .
```

There is no test script yet. Per the plan, Vitest (unit) and Playwright (E2E on critical flows) are the chosen test stack — add them when Phase 1 testing infra lands.

Package manager: the plan locks **pnpm**, but the current lockfile is `package-lock.json` (npm). Don't switch unilaterally — confirm with the user before migrating, and if you do, delete `package-lock.json` and re-pin `engines`/`packageManager`.

## Stack (locked by PRD § 14 / plan § 1)

SvelteKit + Svelte 5 (runes mode forced in `svelte.config.js`) on the Node adapter (Vercel) · TS strict · Tailwind v4 (via `@tailwindcss/vite`, configured in `src/routes/layout.css` with `@import 'tailwindcss'` + `@plugin` directives — no `tailwind.config.ts`) · shadcn-svelte + lucide-svelte (not yet installed) · Better Auth (Prisma adapter) · Neon Postgres + Prisma (pooled URL for app, direct URL for migrations) · Cloudinary for files (signed uploads, browser → Cloudinary direct) · Resend for email · Web Push with VAPID · zod for all form/API validation.

Do not introduce alternatives to any of these without checking the PRD/plan first — they were chosen deliberately.

## Architectural conventions (apply from Phase 1 onward)

These are the patterns every later phase relies on. When you write the first instance of any of these, follow the shape exactly so subsequent phases can plug in.

- **Route groups**: `src/routes/(public)/` for unauthenticated pages, `src/routes/(app)/` for the authenticated shell. `(app)/+layout.server.ts` is the auth guard; `(app)/admin/+layout.server.ts` is the admin role gate. Both re-assert server-side — never trust client role.
- **Data flow**: every page reads via `+page.server.ts` `load`. Every mutation is a form action wrapped in a `withAction(handler)` helper (in `src/lib/server/actions.ts`) that does zod-parse → `requireRole`/ownership check → Prisma transaction (write + audit + notification enqueue) → `{ ok: true }` or `fail(400, { issues })`.
- **RBAC as code**: `src/lib/server/rbac.ts` exposes `can(user, action, resource)` and is the single source of truth used by both server guards and UI affordance rendering.
- **Audit log**: `src/lib/server/audit.ts` `audit({ actor, action, target, before, after })` is called _inside the same Prisma transaction_ as the mutation it logs.
- **Notifications**: `src/lib/server/notify.ts` writes the in-app `Notification` row synchronously, then dispatches email/push asynchronously via `waitUntil`. Email/push failures are caught and logged — `notify` must never throw out of the form action.
- **Uploads**: browser uploads bypass the app server. Flow is `POST /api/uploads/sign` (auth'd, returns signed params) → browser PUTs bytes directly to Cloudinary → `POST /api/attachments` records `(ownerType, ownerId, public_id, secure_url)`. A single `<FileDropzone>` component owns the two-step dance.
- **Auth in components**: read `user` from `$page.data.user` (populated by `(app)/+layout.server.ts`) — do not prop-drill.
- **No raw SQL** outside `src/lib/server/db/` helpers (the `tsvector` search work is the main expected exception).
- **No premature abstraction**: the codebase reuses a small set of helpers (`requireRole`, `withAction`, `audit`, `notify`, `can`, `<FileDropzone>`). Add a new helper only when a third caller appears.

## PWA shell is load-bearing

`IMPLEMENTATION_PLAN.md` § 2 specifies a persistent bottom tab bar on mobile (collapsing to a left sidebar on desktop), iOS-style large titles, sheet-driven create flows, pull-to-refresh on list pages, optimistic UI on cheap actions, and explicit `env(safe-area-inset-*)` handling. The PWA manifest, theme colors, and Apple splash icons ship with the shell in Phase 1 — they are not deferred to the PWA phase. If you touch the shell or any navigation primitive, re-read § 2 first; "make it look like a website" regressions are easy to introduce.

## Editing conventions

- Prettier uses **tabs**, single quotes, no trailing commas, 100-char print width. Run `npm run format` before committing styling changes.
- Runes mode is forced everywhere outside `node_modules` (`svelte.config.js`). Use `$state`, `$derived`, `$props`, `$effect` — not legacy `let`/reactive `$:` declarations — in any new component.
- `tsconfig.json` is strict and has `allowJs`/`checkJs` on. Type errors in `.js` files will fail `npm run check`.

## What's _not_ in v1 (PRD § 4.2)

Native iOS/Android apps, time tracking, leave management, performance reviews, client portals, public report sharing, SSO (email+password only), multi-tenant, third-party API, real-time chat, advanced BI. If a request touches any of these, flag it as out-of-scope before implementing.
