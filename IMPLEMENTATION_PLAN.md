# ADSAT Staff Operations Platform — Implementation Plan

## Context

This plan translates `PRD.md` v0.1 into a build-ready sequence for the ADSAT Staff Operations Platform — a private, mobile-first PWA delivered by Christex Foundation to ADSAT Development Services. The PRD specifies _what_ to build and the acceptance criteria; this document specifies _how_ and in _what order_, with particular attention to making the mobile PWA feel like a native app rather than a responsive website.

Decisions locked with the client engineer before drafting:

- **Mobile shell**: persistent bottom tab bar on mobile, collapses to left sidebar on desktop.
- **Design language**: iOS-style polish (Linear / Things) — generous spacing, sheet-driven flows, soft shadows, large touch targets.
- **Plan shape**: single document, organized by the PRD Appendix A phases.
- **Estimates**: none in this document — sequencing only.

Non-goals (PRD § 4.2) are excluded from this plan per request.

---

## 1. Tech Stack Quick-Reference

Locked by PRD § 14; restated for fast lookup during build.

| Concern       | Choice                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| App framework | SvelteKit (Node adapter, Vercel) + Svelte 5 runes, TS strict           |
| UI primitives | shadcn-svelte + Tailwind + lucide-svelte                               |
| Auth          | Better Auth (Prisma adapter)                                           |
| DB / ORM      | Neon Postgres + Prisma (pooled URL for app, direct URL for migrations) |
| Files         | Cloudinary (signed upload presets, direct browser → Cloudinary)        |
| Email         | Resend (Svelte component templates)                                    |
| Hosting       | Vercel + Vercel Cron + Web Analytics                                   |
| Push          | Web Push (VAPID, no SaaS)                                              |
| Validation    | zod in every form action                                               |
| Testing       | Vitest (unit) + Playwright (E2E on critical flows)                     |
| Package mgr   | pnpm                                                                   |

---

## 2. UI / UX Foundation — Mobile-First PWA Shell

This section is load-bearing. Build it once, in Phase 1, and every later phase plugs into it. The goal: when staff installs the PWA on an iPhone in the field, it must feel like an app, not a website in a browser-chrome-less frame.

### 2.1 Shell layout

Route groups in SvelteKit:

```
src/routes/
  (public)/           → /sign-in, /forgot-password, /reset-password/[token], /accept-invite/[token]
  (app)/              → all authenticated routes; renders the app shell
    +layout.svelte    → shell: top bar + outlet + bottom tab bar (mobile) / sidebar (desktop)
    +layout.server.ts → auth guard, redirects to /sign-in if no user
    admin/            → admin-only subtree; +layout.server.ts asserts role === 'admin'
```

The `(app)` shell renders:

- **Top bar** (mobile + desktop): page title (large, iOS-style), back chevron on detail pages, notification bell, avatar menu. On scroll, title collapses into a compact inline title (iOS Large Title behavior — `position: sticky` + intersection observer).
- **Bottom tab bar** (mobile only, `<md` breakpoint): persistent, 5 slots, role-aware contents (see § 2.2). Lives in a `<nav>` with `padding-bottom: env(safe-area-inset-bottom)` so it sits above the iOS home indicator.
- **Left sidebar** (desktop, `≥md`): same destinations as the tab bar, plus secondary nav (Admin section, Templates) for roles that have access. Collapsible to icons-only on narrow desktops.
- **Outlet**: scroll container with `overscroll-behavior: contain` (prevents the body from bouncing while letting in-page lists pull-to-refresh).

### 2.2 Tab bar contents per role

Exactly 5 slots so spacing stays even. The 5th slot ("Me") is the user avatar + settings + sign-out.

| Slot | Staff                 | Manager      | Admin                                     |
| ---- | --------------------- | ------------ | ----------------------------------------- |
| 1    | Home                  | Home         | Home                                      |
| 2    | Tasks                 | Tasks (team) | Tasks (all)                               |
| 3    | Reports               | Review       | Reports                                   |
| 4    | Inbox (notifications) | Inbox        | Inbox                                     |
| 5    | Me                    | Me           | Me (Admin section reached via Me → Admin) |

Admin's deeper destinations (audit, settings, templates, staff directory) live under a "More" screen reached from "Me" on mobile, and the sidebar on desktop. This keeps the tab bar uncluttered.

### 2.3 Interaction patterns

- **Create flows = sheets**, not full-page navigation. "Submit report", "Assign task", "Invite staff" open as slide-up sheets on mobile and centered dialogs on desktop. Use shadcn-svelte's `Sheet` and `Dialog` primitives.
- **Detail pages = full-screen with back chevron**, mirroring iOS navigation stack. Animate forward (slide-in from right) on mobile.
- **Pull-to-refresh** on list pages (My Tasks, My Reports, Inbox). Implement with a small custom component since native pull-to-refresh only fires when the document scrolls.
- **Optimistic UI** on cheap, reversible actions (toggle task to in-progress, mark notification read). Roll back with a toast on server error.
- **Skeleton screens** instead of spinners while data loads. Pre-render skeletons from the cached shape so the first paint already looks like the page.
- **Toasts** (shadcn `Sonner`) anchored above the tab bar on mobile so they don't get hidden.
- **Empty states** with an illustration + a single primary action (e.g. "No tasks yet" → "Browse templates").

### 2.4 Visual system

- **Type**: Inter (variable). System font fallback. Large-title 28px / 700, page-title 20px / 600, body 15px / 400.
- **Spacing**: 4-px grid. Default page padding 16px on mobile, 24px on desktop.
- **Color**: shadcn defaults extended with one brand accent (TBD — open question #1 in PRD). Light theme at launch; CSS variables structured for dark theme later.
- **Radius**: 12px on cards, 8px on inputs, 999px on pills.
- **Shadow**: layered (`shadow-sm` on cards at rest, `shadow-md` on lifted/active). No harsh borders.
- **Touch targets**: ≥ 44 × 44 px on every interactive element.
- **Motion**: 150–200ms ease-out for most transitions. Sheets use a spring (`cubic-bezier(0.32, 0.72, 0, 1)` — the iOS sheet curve).
- **Safe areas**: `env(safe-area-inset-*)` honored in the shell and any fixed elements (FAB-style buttons, toasts, sheets).

### 2.5 PWA specifics tied to the shell

These are not deferred to the PWA phase — they ship with the shell so the install experience is right from day one:

- `manifest.webmanifest` with `display: standalone`, `start_url: /dashboard`, maskable icons.
- Theme color set per route to match the top bar color (matters for the iOS status bar when installed).
- Splash icons (Apple PWA splash images for major iPhone sizes).
- Installed-mode detection (`window.matchMedia('(display-mode: standalone)')`) to hide the in-app "Install" banner once installed.

---

## 3. Cross-Cutting Architectural Patterns

Establish these in Phase 1; every subsequent phase reuses them.

### 3.1 Auth guard pattern (PRD § 15.1)

- `hooks.server.ts` resolves session → `event.locals.user` on every request.
- `(app)/+layout.server.ts` redirects to `/sign-in` if `locals.user` is null.
- `(app)/admin/+layout.server.ts` returns 403 if `user.role !== 'admin'`.
- Form actions never trust client role; each re-asserts with a small `requireRole(locals, ['admin'])` helper in `src/lib/server/auth/guards.ts`.

### 3.2 Data fetching & mutation pattern (PRD § 15.2)

- Every page has a `+page.server.ts` `load` returning the minimum data shape.
- All mutations go through form actions; structure each as:
  1. `zod` parse of `await request.formData()`
  2. `requireRole` / ownership check
  3. Prisma transaction wrapping data write + audit log + notification enqueue
  4. Return `{ ok: true }` or `fail(400, { issues })` with field-level errors

A small `withAction(handler)` helper in `src/lib/server/actions.ts` standardizes the validate-authorize-execute-respond shape.

### 3.3 Notification dispatch (PRD § 15.3)

- `src/lib/server/notify.ts` exposes `notify({ recipientId, type, payload })`.
- Writes a `Notification` row synchronously (in-app), then dispatches email and push asynchronously (`waitUntil` on Vercel) so user-facing actions are not blocked.
- Resend and Web Push calls are wrapped in `try/catch` with structured error logging — never throw out of `notify`.

### 3.4 Cloudinary signed uploads (PRD § 15.4)

- `POST /api/uploads/sign` — authenticated, returns signed params for a target folder.
- Browser uploads directly to Cloudinary; on success, posts `{ public_id, secure_url, … }` to `POST /api/attachments` with parent `(ownerType, ownerId)`.
- A single `<FileDropzone>` component handles drag-and-drop, progress per file, cancel, and the two-step POST dance.

### 3.5 Audit log helper

- `src/lib/server/audit.ts` exposes `audit({ actor, action, target, before, after })`.
- Called from inside the same transaction as the mutation it logs, so an audit entry and its mutation succeed or fail together.

### 3.6 RBAC matrix as code

- `src/lib/server/rbac.ts` encodes PRD § 12 as a function `can(user, action, resource)`. Used by both server guards and to render/hide UI affordances. Single source of truth for permissions.

---

## 4. Build Phases

Phases mirror PRD Appendix A. Each phase lists the PRD requirements it satisfies, the key files/modules it adds, and the acceptance checks before moving on.

### Phase 1 — Foundation

**Satisfies**: FR-AUTH-1, FR-AUTH-2 (invite flow scaffold), FR-AUTH-3, FR-AUTH-4, FR-AUTH-5, PRD § 17 (PWA manifest baseline).

**Build**:

- Scaffold SvelteKit + TS strict + Tailwind + shadcn-svelte init + lucide-svelte.
- Prisma + Neon: project, pooled + direct connection strings, base `User`, `Account`, `Session`, `VerificationToken`, `Department` models.
- Better Auth wired with Prisma adapter; `/api/auth/[...all]/+server.ts`.
- `hooks.server.ts` populates `event.locals.user`.
- `(public)` and `(app)` route groups + the shell described in § 2.
- Sign-in, sign-out, forgot/reset password, accept-invite pages — fully styled.
- PWA manifest + service worker stub (pre-cache app shell only; runtime caching arrives in Phase 8).
- Resend account, sender domain DNS, `src/lib/server/email/` with one working template (invitation).
- CI: lint + typecheck + Vitest on every PR.

**Acceptance**:

- A user can sign in, reset their password, accept an invite from email, sign out.
- Installing the PWA on an iPhone shows the shell with the correct status-bar color, no browser chrome, splash icon, and the bottom tab bar above the home indicator.
- Lighthouse PWA installability check passes.
- All forms are keyboard-navigable; sign-in passes axe on the page level.

### Phase 2 — Users & RBAC

**Satisfies**: FR-USER-1 through FR-USER-4, FR-AUTH-5 (profile), PRD § 12 (RBAC matrix), partial FR-AUDIT-1 (user-related actions).

**Build**:

- `src/lib/server/rbac.ts` encoding the full matrix.
- `requireRole` and `can` helpers.
- `/staff` directory (table on desktop, card list on mobile), `/staff/[id]` detail, `/staff/invite` sheet.
- Profile page (`/profile`) with editable fields + Cloudinary photo upload (the upload pattern is built here even though the rest of attachments is Phase 6 — profile photo is the simplest case and proves the path).
- `AuditLog` model + first `audit()` calls for: invite, activate, deactivate, role change.
- Deactivation flow (with confirmation modal).

**Acceptance**:

- Admin can invite, edit, deactivate, and reactivate staff. Manager sees only their team and read-only. Staff sees only themselves.
- Role-change attempts from non-admin users are rejected server-side with 403 (verified with a Playwright test).
- Deactivated user cannot sign in.
- Profile photo upload works on mobile (camera roll + take-photo from camera).

### Phase 3 — Tasks

**Satisfies**: FR-TASK-1 through FR-TASK-9.

**Build**:

- Prisma models: `Task`, `TaskStatusEvent`, `TaskComment`, `TaskTemplate`.
- `/tasks` list — role-aware (My / Team) with filters, sort, default "not completed".
- `/tasks/new` as a sheet on mobile, dialog on desktop. "Start from template" pre-fill.
- `/tasks/[id]` detail with status buttons, comments thread, attachments placeholder (real upload UI lands Phase 6), reassign, edit, delete.
- Status lifecycle enforced server-side; every transition writes a `TaskStatusEvent`.
- `/templates/tasks` and `/templates/tasks/[id]` (admin).
- Notifications enqueued for assignment, status change, comment, @mention (delivery wired in Phase 5; rows written now).

**Acceptance**:

- Staff can move their own tasks through the allowed transitions only; illegal transitions return 403.
- Overdue tasks render with the warning color treatment on the list row.
- Comments cannot be edited after 15 minutes (verified by a unit test on the action).
- Soft-deleted tasks disappear from default views but remain in DB; admin can see them in a "trash" filter.

### Phase 4 — Reports

**Satisfies**: FR-REP-1 through FR-REP-9.

**Build**:

- Prisma models: `ReportTemplate`, `ReportField`, `Report`, `ReportFieldValue`, `ReportComment`. Template versioning: a new version row on edit; `Report` pins `templateVersion`.
- `/templates/reports` admin form (v1 is a simple form per PRD; visual drag-drop builder is post-v1).
- `/reports/new` — picks a template, renders the form dynamically from `ReportField` rows. All field types per PRD § 7.4: short text, long text, number, date/datetime, dropdown, multi-select, checkbox, file/image, geolocation.
- Auto-save drafts every 10s to server (offline draft handling lands Phase 8).
- `/reports` (My / Team) + `/reports/[id]` detail with review actions.
- Review workflow: comment, request revision (modal forces a comment), approve. Reopen-from-approved (admin only) writes audit entry.

**Acceptance**:

- A report submitted against template v1 still renders correctly after the template is edited to v2.
- Required fields block submission with inline errors; client + server both validate.
- Reviewer queue defaults to `submitted` status.
- Geolocation field captures lat/lng on a mobile browser (tested on iOS Safari).

### Phase 5 — Notifications

**Satisfies**: FR-NOTIF-1 through FR-NOTIF-4, completes the notification deliveries enqueued in Phases 2–4.

**Build**:

- `src/lib/server/notify.ts` per § 3.3.
- Bell icon in top bar with unread count badge; dropdown sheet on mobile / popover on desktop with last 20.
- `/notifications` full history page.
- Email templates as Svelte components → rendered to HTML; one per event category.
- `NotificationPreference` model + `/profile` preferences UI (per-channel toggles, quiet hours, pause-until).
- Web Push: VAPID keys generated and added to env; service worker handles `push` + `notificationclick`; opt-in flow surfaced contextually (after first task assignment, not on first load).
- Vercel Cron jobs: daily 07:30 local for due-tomorrow + overdue reminders. Job iterates users in batches, respects each user's time zone.

**Acceptance**:

- A task assignment generates in-app row + email (if enabled) + push (if subscribed).
- Quiet-hours suppress push but not in-app or email.
- Unsubscribe link in email updates preference and reaches the right channel.
- Cron job runs in preview environment without sending real emails (dry-run flag honored).

### Phase 6 — Attachments

**Satisfies**: FR-FILE-1, FR-FILE-2, FR-FILE-3.

**Build**:

- `Attachment` model with polymorphic `(ownerType, ownerId)`.
- `/api/uploads/sign` + `/api/attachments` endpoints.
- `<FileDropzone>` component: drag-and-drop on desktop, tap-to-pick + take-photo on mobile, per-file progress, cancel.
- Wired into task creation, task comments, report fields (file/image type), report comments.
- Inline image rendering with Cloudinary-generated thumbnails (`w_400,h_400,c_fill,f_auto,q_auto`).
- Delete flow (per FR-FILE-3) including best-effort Cloudinary delete with logged failure.

**Acceptance**:

- Uploads bypass our server (verified by Network tab: only `/sign` and `/attachments` calls hit our origin; bytes go straight to Cloudinary).
- Mobile camera capture works on iOS Safari and Android Chrome.
- File-type and size limits enforced both client-side (early UX) and server-side (authoritative, in `/sign`).
- Deleted attachments are gone from the UI immediately even if Cloudinary delete is slow.

### Phase 7 — Dashboards & Search

**Satisfies**: FR-DASH-1, FR-DASH-2, FR-DASH-3, FR-SEARCH-1.

**Build**:

- Role-aware `/dashboard` rendered server-side. Cards (counts, trends, quick actions) sized for thumb-tap on mobile.
- Dashboard data loaders compose existing queries; no new domain models.
- Postgres full-text search with `tsvector` columns on `Task.title/description`, `ReportFieldValue.valueText`, `TaskComment.body`, `ReportComment.body`. GIN indexes.
- Global search command (`Cmd/Ctrl + K` on desktop, search icon in top bar on mobile) opening a sheet with grouped results. Results filtered through the RBAC visibility scope at the query level.

**Acceptance**:

- A staff user's search results never include data outside their scope (Playwright test creates cross-user data and asserts invisibility).
- Dashboard renders < 1.5s on a throttled slow-4G profile (Lighthouse).
- Trend deltas are correct vs the previous calendar week.

### Phase 8 — PWA & Offline

**Satisfies**: FR-PWA-1, FR-PWA-2, FR-PWA-3, FR-PWA-4 (push code shipped Phase 5; here we add caching + offline drafts).

**Build**:

- Service worker upgraded with runtime caching:
  - App shell: stale-while-revalidate.
  - Scoped API GETs (own tasks last 50, active templates for current user, last 20 notifications): network-first with cache fallback.
- Offline banner component listening to `navigator.onLine`.
- IndexedDB-backed draft store for reports (10s auto-save, queued submission on reconnect).
- `/offline` page for navigation fallbacks.
- Background sync registration for queued submissions; replays in order on `online` event with per-item success/error toasts.
- Contextual "Install" banner shown only to mobile users in browser mode after their second visit.

**Acceptance**:

- Airplane mode test on iPhone: app opens, dashboard shows last-fetched data with offline banner, a report draft can be started and saved, reconnecting submits it and toasts success.
- Cache versioning: bumping the SW version invalidates old caches without orphaning IndexedDB drafts.
- Lighthouse PWA score remains 100.

### Phase 9 — Audit & Polish

**Satisfies**: FR-AUDIT-1 fully, PRD § 9.1 (a11y), § 9.2 (perf), § 9.3 (security).

**Build**:

- `/admin/audit` page with filters and CSV export.
- Backfill `audit()` calls anywhere missed during earlier phases (template create/edit/archive, attachment delete, sign-out everywhere, sign-in rate-limit hits).
- Accessibility audit: axe across every route; keyboard-only walkthrough; VoiceOver pass on critical flows.
- Performance enforcement: bundle-size check in CI (`< 150KB gzipped initial JS`); lazy-load admin and templates routes; image budget per page.
- Security pass: OWASP Top 10 review; CSP headers set (`default-src 'self'`, whitelist Cloudinary + Resend tracking if any); rate-limit middleware on `/sign-in`, `/forgot-password`, `/accept-invite/[token]`; Dependabot enabled.
- Sentry (or Vercel observability) configured for client + server errors.

**Acceptance**:

- Audit log entries exist for every action listed in FR-AUDIT-1.
- axe DevTools reports zero serious/critical issues on every route.
- Core Web Vitals on a Moto G4 / slow-4G simulation meet PRD § 9.2 budgets.
- CSP violations would be caught (intentional violation in dev triggers a Sentry event).

### Phase 10 — Pilot & Launch

**Satisfies**: PRD § 18 (success metrics instrumentation), open questions #6–#9.

**Build**:

- Seed scripts for: departments, 2–3 example report templates (from ADSAT per open question #6), the director's admin account.
- Onboarding checklist surfaced on first-admin sign-in (invite staff → create template → assign first task).
- Lightweight metric capture in the audit log + a Vercel-side query for the success metrics in PRD § 18 (no analytics SaaS).
- Short admin walkthrough doc (Markdown, lives in the repo's `/docs`).
- Production cut-over: DNS, env vars audit, Neon backup confirmation, first real users invited.

**Acceptance**:

- Pilot users (per open question #7) complete all golden flows end-to-end on their own devices.
- Director can answer all PRD § 18 metric questions with one click each.
- All open questions in PRD § 20 have a resolution recorded somewhere in the repo.

---

## 5. Cross-Cutting Concerns (apply throughout)

- **Server-first.** Every data read on first load goes through `+page.server.ts`. Client-side fetches reserved for revalidation and interactions.
- **Validate everything with zod**, including URL params (`+page.server.ts` `load` params), form bodies, and JSON API bodies. Reuse schemas between client and server.
- **No raw SQL** except inside dedicated `src/lib/server/db/` helpers (e.g. the `tsvector` search). Everything else through Prisma.
- **One Tailwind plugin for design tokens** (`tailwind.config.ts` extends `colors`, `spacing`, `boxShadow`, `borderRadius`, `fontSize`). No magic numbers in components.
- **No prop-drilling auth**. Components needing `user` read from `$page.data.user` (populated by `(app)/+layout.server.ts`).
- **Avoid premature abstraction**. The phases reuse a handful of helpers (`requireRole`, `withAction`, `audit`, `notify`, `<FileDropzone>`); add others only when a third caller appears.

---

## 6. Critical Files & Directories (representative — not exhaustive)

```
src/
  app.html                           ← <meta name=theme-color>, splash links
  hooks.server.ts                    ← session → locals.user
  routes/
    (public)/sign-in/+page.svelte
    (public)/accept-invite/[token]/+page.server.ts
    (app)/+layout.svelte             ← shell: top bar + tab bar
    (app)/+layout.server.ts          ← auth guard
    (app)/dashboard/+page.server.ts
    (app)/tasks/+page.server.ts
    (app)/tasks/new/+page.server.ts  ← sheet on mobile
    (app)/tasks/[id]/+page.server.ts
    (app)/reports/...
    (app)/staff/...
    (app)/profile/+page.server.ts
    (app)/admin/+layout.server.ts    ← role === 'admin'
    (app)/admin/audit/+page.server.ts
    api/auth/[...all]/+server.ts     ← Better Auth
    api/uploads/sign/+server.ts
    api/attachments/+server.ts
  lib/
    server/
      auth/guards.ts                 ← requireRole, can
      rbac.ts                        ← matrix as code
      actions.ts                     ← withAction(handler)
      notify.ts
      audit.ts
      email/                         ← Resend + Svelte templates
      db/search.ts                   ← tsvector helpers
    components/
      shell/TopBar.svelte
      shell/TabBar.svelte
      shell/Sidebar.svelte
      forms/FileDropzone.svelte
      ui/                            ← shadcn-svelte additions
prisma/
  schema.prisma                      ← multi-file split as it grows
  migrations/
service-worker.ts                    ← cache + push + background sync
static/
  manifest.webmanifest
  icons/                             ← maskable + Apple splash
```

---

## 7. Verification — End-to-End

Before declaring the platform launch-ready, run this top-to-bottom:

1. **Playwright suite** covering: sign-in, password reset, accept-invite, assign task, staff completes task, submit report, request revision, resubmit, approve report, install PWA, offline draft + reconnect submission.
2. **Manual device pass** on an iPhone (Safari, then installed PWA) and an Android (Chrome, then installed PWA): every screen in the bottom tab bar; one create flow per role; push notification arrival.
3. **Lighthouse** on production URL: PWA = 100, Performance ≥ 90 on mobile profile, Accessibility = 100.
4. **axe DevTools** automated scan across every route; zero serious/critical.
5. **Security**: a non-admin Playwright session attempts every admin action via crafted POSTs and is rejected with 403.
6. **Backup recovery rehearsal**: restore a Neon point-in-time snapshot into a staging environment; app boots and serves data.
7. **Email deliverability**: send through Resend to Gmail, Outlook, and a custom domain; SPF/DKIM/DMARC pass per mxtoolbox.
8. **Director walk-through**: live session covering invite, template, task, review, audit log. Sign-off recorded.

---

## 8. Open Items Carried From PRD

These remain blockers for specific phases. Resolve as part of Phase 1 setup wherever possible.

| PRD Q#                | Blocks                      | Needed by                           |
| --------------------- | --------------------------- | ----------------------------------- |
| #1 Branding           | Visual system finalization  | Phase 1 (or use placeholder + swap) |
| #2 Domain             | Vercel domain + email links | Phase 1                             |
| #3 Email sender       | Resend DNS                  | Phase 1                             |
| #5 Data residency     | Neon region                 | Phase 1 (before first migration)    |
| #6 Seed templates     | Realistic Phase 10 launch   | Phase 10                            |
| #7 Pilot users        | Pilot rollout               | Phase 10                            |
| #8 Migration cut-over | Launch plan                 | Phase 10                            |
| #9 Director training  | Launch readiness            | Phase 10                            |

---

_End of plan._
