# ADSAT Staff Operations Platform — Product Requirements Document

## 1. Document Control

| Field | Value |
|---|---|
| **Product name** | ADSAT Staff Operations Platform (working title) |
| **Client** | ADSAT Development Services |
| **Author** | Christex Foundation (Engineering) |
| **Document version** | 0.1 (draft) |
| **Date** | 2026-05-23 |
| **Status** | Draft — pending client review |
| **Distribution** | Client stakeholders, build team |

This document is the single source of truth for v1 scope. Changes after sign-off require a written amendment.

---

## 2. Executive Summary

ADSAT Development Services will receive a private, web-based operations platform — installable on mobile as a Progressive Web App — that lets the director manage staff accounts, assign work, and collect activity reports in one place. The platform replaces ad-hoc coordination over messaging apps, spreadsheets, and email with a single, role-aware workspace where every task has a clear owner and every report has a clear reviewer. Designed for a team of under fifteen staff across multiple service lines, the platform ships with configurable task and report templates so each program can capture the information that matters to it without bespoke development.

---

## 3. Background & Problem Statement

ADSAT runs multiple service lines with a small staff. Today the operational pattern (inferred from organization size and the absence of existing tooling) likely looks like:

- Staff assignments communicated verbally or via messaging apps.
- Reports collected as Word documents over email or shared drives.
- Status of any given piece of work is known only to whoever last spoke about it.
- Historical records are scattered, making review and accountability difficult.
- No single view of who is doing what, or what's overdue.

**The result**: leadership spends time chasing updates, work falls through the cracks, and the organization has no operational memory beyond individuals' inboxes.

**The desired outcome**: every active piece of work has a named owner, a status, and a deadline; every report is captured in a structured, searchable form; leadership has a real-time view of the organization's workload; and staff have a clear, single place to see what's expected of them and to submit what they've done.

---

## 4. Goals & Non-Goals

### 4.1 Goals (v1)

- **G1.** A single authenticated workspace for ADSAT staff, accessible on desktop and mobile.
- **G2.** Director can invite staff, assign roles, and deactivate accounts without engineering help.
- **G3.** Director/manager can assign tasks to staff with deadlines and track status to completion.
- **G4.** Staff can submit structured reports via templates configurable per program.
- **G5.** Every user has a role-scoped dashboard showing what's on their plate.
- **G6.** Notifications (in-app + email) keep work moving without daily check-ins.
- **G7.** The platform is installable as a PWA and remains usable on low-bandwidth mobile connections.
- **G8.** All historical tasks and reports are searchable and exportable.

### 4.2 Non-Goals (v1)

Explicitly **out of scope** for the first release. These may be revisited in later versions.

- Native iOS / Android apps (PWA only).
- Time tracking, timesheets, or payroll.
- Leave / absence management.
- Performance reviews or 1-on-1 notes.
- Client- or beneficiary-facing portals.
- Public read-only report sharing.
- SSO (Google / Microsoft) — email + password only at launch.
- Multi-tenant / multi-workspace architecture.
- Third-party API for external integrations.
- Real-time chat or video.
- Advanced analytics / BI dashboards (basic counts only).

---

## 5. Personas & Roles

The platform has three roles. A user holds exactly one role at a time.

### 5.1 Admin (typically the director / founder)

- **Goals**: see everything, manage everyone, set up the platform.
- **Capabilities**: full read/write on all data; manage users; manage programs and templates; view audit log; configure org-wide settings.
- **Day-in-the-life**: invites a new staff member, creates a task template for the new program, reviews yesterday's submitted reports, approves three, sends two back for revision.

### 5.2 Manager (program / team lead)

- **Goals**: keep their team's work moving; review their team's reports.
- **Capabilities**: assign tasks to staff in their team; review reports submitted to them; view their team's dashboards. Cannot manage user accounts or platform settings.
- **Day-in-the-life**: opens dashboard, sees three overdue tasks, nudges via comment, reviews two new reports, requests revision on one.

### 5.3 Staff (front-line / field / office worker)

- **Goals**: know what they're supposed to do; report on what they've done.
- **Capabilities**: see and update their own tasks; submit reports; view their own history; comment on their tasks.
- **Day-in-the-life**: opens app on phone before going to the field, sees today's tasks, marks one in-progress, completes the work, snaps a photo and submits the daily activity report, marks task complete.

### 5.4 Future roles (not v1)

- **Viewer / read-only stakeholder** (board member, external auditor) — deferred.
- **Reviewer** as a separate role from Manager — deferred; for v1 a Manager handles review.

---

## 6. Scope Summary

### 6.1 In scope (v1)

- Authentication and account management
- Staff directory and user administration
- Task management with templates, comments, and status lifecycle
- Report submission with configurable templates and review workflow
- Role-scoped dashboards
- In-app + email notifications (web push where supported)
- File and image attachments (Cloudinary)
- Global search across staff, tasks, reports
- Audit trail of sensitive actions
- PWA install + offline-tolerant behavior

### 6.2 Out of scope (v1)

See § 4.2.

### 6.3 Phasing

Per client direction, this PRD does **not** commit to a release timeline. The build team will produce an implementation plan with milestones after PRD sign-off. The PRD lists features as **must-have for v1** (Functional Requirements, § 7) and **post-v1 candidates** (§ 8) so prioritization is unambiguous at planning time.

---

## 7. Functional Requirements

Each requirement is written as a user story with explicit acceptance criteria. The build team should treat acceptance criteria as the definition of done.

### 7.1 Authentication & Account

#### FR-AUTH-1: Email + password sign-in

**As a** staff member, **I want** to sign in with my email and password, **so that** I can access the platform securely.

- Email + password form on `/sign-in`.
- Wrong credentials show a generic "Email or password is incorrect" message (no user enumeration).
- After 5 failed attempts within 10 minutes, sign-in is rate-limited for that account.
- Successful sign-in creates a session and redirects to the role-appropriate dashboard.
- Sessions persist across browser restarts ("remember me" implied — no separate checkbox).

#### FR-AUTH-2: Admin-invited account creation

**As an** admin, **I want** to invite a staff member by email, **so that** they can join the platform without me handing them a password.

- Admin enters: name, email, role, optional department/program.
- System sends an invitation email with a one-time-use link valid for 7 days.
- Invitee clicks link → lands on a "set your password" page → sets password meeting policy (min 10 chars, at least one number, not in common-password list).
- After setting password, the invitee is automatically signed in and lands on their dashboard.
- Invitation links can be revoked or resent by the admin from the staff directory.

#### FR-AUTH-3: Password reset

**As a** user, **I want** to reset my password if I forget it, **so that** I'm not locked out.

- "Forgot password?" link on sign-in page.
- User enters email → always shown "If that email exists, we sent a link" (no enumeration).
- Email contains a reset link valid for 1 hour, single-use.
- Reset page enforces password policy.
- Resetting a password invalidates all existing sessions for that user.

#### FR-AUTH-4: Sign out

- "Sign out" action in user menu signs out the current session.
- "Sign out everywhere" option invalidates all sessions for the user across all devices.

#### FR-AUTH-5: Profile management

**As a** user, **I want** to update my profile, **so that** my colleagues see accurate information.

- Editable fields: full name, phone number, profile photo, time zone, notification preferences.
- Read-only fields: email, role, department (only admin can change these).
- Profile photo uploaded to Cloudinary; old photo URL replaced on update.

---

### 7.2 Staff Directory & User Management

#### FR-USER-1: List & search staff

**As an** admin or manager, **I want** to browse all staff, **so that** I can find people quickly.

- Table view with columns: photo, name, role, department, status (active/deactivated), last active.
- Filter by role, department, status.
- Text search by name or email.
- Pagination at 25/page; default sort by name ascending.
- Manager view is read-only and limited to staff in their team.

#### FR-USER-2: View staff member profile

- Clicking a row opens a detail view: profile info, role, current open tasks count, recent reports count, activity timeline.
- Admin can see all; manager sees their team only; staff can only view their own.

#### FR-USER-3: Edit staff member (admin only)

- Admin can edit: name, phone, department, role.
- Role changes are logged to the audit trail.
- Cannot change a user's email (would require email-change verification flow — deferred).

#### FR-USER-4: Deactivate staff member (admin only)

- "Deactivate" action requires confirmation.
- Deactivated users cannot sign in.
- Existing tasks and reports are preserved; the user remains visible (greyed out) in historical views.
- Deactivation is reversible via "Reactivate" action.
- Hard delete is **not** available in v1 (preserves data integrity).

---

### 7.3 Task Management

#### FR-TASK-1: Create a task

**As an** admin or manager, **I want** to create and assign a task, **so that** a staff member knows what to do.

Fields:
- Title (required, 1–140 chars)
- Description (optional, rich text — bold, italic, lists, links)
- Assignee (single staff member, required)
- Due date (optional but encouraged)
- Priority: Low / Medium / High (default Medium)
- Program / category (optional, from admin-managed list)
- Attachments (optional, up to 10 files / 25 MB each)

Behavior:
- On save, task appears in assignee's "My Tasks" instantly.
- Assignee receives an in-app and email notification (per their preferences).
- Creator is recorded as the "assigner."

#### FR-TASK-2: Task status lifecycle

States: `assigned` → `in_progress` → `submitted` → `completed`. Additional terminal/branch states: `blocked`, `cancelled`.

Transitions:
- Staff can move their own tasks: `assigned ↔ in_progress`, `in_progress → submitted`, any → `blocked`.
- Admin/manager can move to any state, including `completed` and `cancelled`.
- Each transition is timestamped and logged in the task's history.

#### FR-TASK-3: View my tasks (staff)

**As a** staff member, **I want** to see my assigned work in one place, **so that** I know what to do today.

- `My Tasks` page lists tasks assigned to me.
- Default filter: not completed and not cancelled.
- Filters: status, priority, program, due date range.
- Sort options: due date (default), priority, recently updated.
- Each row shows: title, due date (color-coded if overdue), priority, status, assigner avatar.

#### FR-TASK-4: View team tasks (manager/admin)

**As a** manager, **I want** to see all tasks across my team, **so that** I can spot bottlenecks.

- `Team Tasks` page lists tasks for users in scope.
- Filters: assignee, status, priority, program, overdue (yes/no).
- Bulk view; row actions: open, reassign (manager+), cancel (manager+).

#### FR-TASK-5: Task detail page

- Shows all task fields + status history + comments thread + attachments.
- Action buttons reflect current user's permissions.
- "Mark in progress / submitted / blocked" buttons for staff; "Complete / cancel / reassign / edit" for manager+.

#### FR-TASK-6: Comments on a task

- Threaded list under task detail.
- Plain text + @mention support (mention triggers notification).
- Anyone with access to the task can comment (assignee + assigner + admins).
- Comments cannot be edited after 15 minutes; deletion is admin-only and logged.

#### FR-TASK-7: Reassign a task (manager/admin)

- Action on task detail. Confirms intent.
- New assignee receives notification; previous assignee receives "task removed from your queue."
- Audit log entry created.

#### FR-TASK-8: Task templates (admin)

**As an** admin, **I want** to define reusable task templates per program, **so that** repeated work is fast to assign.

- Admin creates a template with: name, default description, default priority, default program, optional default due-date offset (e.g. "+3 days from creation").
- When creating a task, user can "start from template" — pre-fills fields, user picks assignee and due date.
- Templates can be edited or archived (archive hides from picker but preserves linkage on past tasks).

#### FR-TASK-9: Edit / delete a task

- Edit: open to assigner + admin until task is `completed`. Edits to title, description, priority, due date, program, attachments are logged.
- Delete: admin only. Soft-delete (hidden from default views, recoverable for 30 days, then purged). Logged in audit trail.

---

### 7.4 Report Submission

#### FR-REP-1: Submit a report via a template

**As a** staff member, **I want** to submit a report using a template my admin set up, **so that** I capture the right information without guesswork.

- Staff opens "Submit report" → picks a report template (filtered by their program).
- Form renders fields per the template definition (see FR-REP-5 for field types).
- Staff fills fields, attaches files/photos, can save as draft.
- "Submit" transitions the report from `draft` to `submitted` and notifies the assigned reviewer (or program manager / admin fallback).

#### FR-REP-2: Report status lifecycle

States: `draft` → `submitted` → `under_review` → (`approved` | `needs_revision`).
- `needs_revision` → returns to author who can resubmit (transitions back to `submitted`).
- `approved` is terminal but may be reopened by admin (logged).

#### FR-REP-3: Save draft & resume later

- Drafts are auto-saved every 10 seconds while editing.
- Drafts persist offline (PWA) and sync when reconnected.
- "My Drafts" is a filter on the reports page.

#### FR-REP-4: Review a submitted report (manager/admin)

- Reviewer sees report in their queue.
- Reviewer can: add a comment, request revision (status → `needs_revision` with comment required), approve (status → `approved`).
- Approval / revision triggers notification to the author.

#### FR-REP-5: Report templates (admin)

**As an** admin, **I want** to define structured templates per program, **so that** field staff capture consistent data.

Supported field types (v1):
- Short text (single line, with min/max length)
- Long text (multi-line, with min/max length)
- Number (with optional min/max)
- Date / date+time
- Dropdown (single-select, admin-defined options)
- Multi-select (admin-defined options)
- Checkbox (yes/no)
- File / image upload (admin sets max count and total size)
- Geolocation (lat/lng captured from device, optional address lookup)

Per field: label, help text, required flag, default value (where applicable), display order.

Template metadata:
- Name, description, program/category, assigned reviewer role (manager / admin), active flag.
- Versioning: editing a template after submissions exist creates a new version; old submissions remain on their original version.

#### FR-REP-6: View my reports (staff)

- `My Reports` lists reports I've authored.
- Filters: status, template, date range.
- Each row shows: title (template name + submission date), status, reviewer, last update.

#### FR-REP-7: View team reports (manager/admin)

- `Team Reports` lists reports submitted by users in scope.
- Filters: status, template, author, date range, program.
- Default filter: status = `submitted` (i.e. the review queue).

#### FR-REP-8: Comments on a report

- Same model as task comments (FR-TASK-6).

#### FR-REP-9: Link report to task (optional)

- When submitting a report, staff can optionally select a related task. The task and report cross-link in their detail views.

---

### 7.5 Dashboards

#### FR-DASH-1: Staff dashboard

On sign-in, staff sees:
- "My open tasks" count (clickable → filtered task list)
- "Due this week" count
- "Reports awaiting revision" count
- "Recent activity" feed: last 10 events involving them (task assigned, status changed, report approved, comment received)
- Quick action: "Submit a report"

#### FR-DASH-2: Manager dashboard

- "My team open tasks" count
- "Team overdue tasks" count
- "Reports pending my review" count
- "Recent team submissions" list (last 10)
- Quick actions: "Assign a task", "Review reports"

#### FR-DASH-3: Admin dashboard

- Org-wide totals: active users, open tasks, tasks completed this week, reports submitted this week, reports awaiting review.
- Trend indicator vs previous week (↑ ↓ %, no chart in v1).
- "Recent activity" feed (last 20 events across the org).
- Quick actions: "Invite staff", "Create template", "View audit log".

---

### 7.6 Notifications

#### FR-NOTIF-1: In-app notification center

- Bell icon in header; unread badge with count.
- Dropdown shows last 20 notifications.
- Clicking a notification deep-links to the relevant task / report / comment and marks it read.
- "Mark all read" and "See all" actions.

#### FR-NOTIF-2: Email notifications

Triggered events:
- Task assigned to me
- Task due tomorrow (one reminder per task; sent in the user's time zone at 8am local)
- Task overdue (one reminder per task at 8am the day after the due date)
- Task status changed (notify assigner only)
- Comment on my task / report
- @mention in a comment
- Report submitted (to the assigned reviewer)
- Report needs revision (to author)
- Report approved (to author)
- Account invitation (FR-AUTH-2)
- Password reset (FR-AUTH-3)

Emails are transactional (no marketing). Each email has a deep link back to the relevant resource and an "unsubscribe from this type" link (which adjusts notification preferences but cannot disable system-critical emails like password reset).

#### FR-NOTIF-3: Web push notifications

- Browser-supported web push for the same triggers as email.
- User must opt in via browser prompt; opt-in remembered per device.
- Push notifications honor "Do Not Disturb" hours set in user preferences (default: 20:00–07:00 local).

#### FR-NOTIF-4: User notification preferences

In profile settings:
- Per channel (in-app / email / push): on / off per event category.
- Quiet hours (start, end, time zone).
- "Pause all non-critical notifications until [date]" toggle.

---

### 7.7 File & Image Attachments

#### FR-FILE-1: Upload attachments

- Drag-and-drop or file picker, on task creation, task comment, report submission, and report comment.
- Allowed types: images (jpg, png, webp, heic), documents (pdf, docx, xlsx, csv), text (txt).
- Max file size: 25 MB per file (configurable by admin in settings).
- Max files per upload action: 10.
- Files upload directly to Cloudinary from the browser using signed upload presets (server signs the upload params; browser uploads bytes directly to Cloudinary).
- Upload progress shown per file; user can cancel mid-upload.
- After upload, Cloudinary public_id and secure URL are stored in our DB linked to the parent task/report/comment.

#### FR-FILE-2: View / download attachments

- Images render inline (thumbnail in lists, full image in detail/modal).
- Non-image files show file-type icon, name, size, and download link.
- All Cloudinary URLs are signed / authenticated where possible. For v1, files are served via secure URLs scoped to authenticated sessions; direct public URLs are not exposed.

#### FR-FILE-3: Delete attachments

- Uploader can remove their own attachment before the parent (task/report) reaches a terminal state.
- Admin can delete any attachment; deletion is logged.
- Deletion removes the asset from Cloudinary (best-effort; failure is logged but does not block UI).

---

### 7.8 Search

#### FR-SEARCH-1: Global search

- Search bar in header; keyboard shortcut `Cmd/Ctrl + K`.
- Searches across: staff (name, email), tasks (title, description), reports (title, text-field content), comments (body).
- Results grouped by entity type with up to 5 per group + "see all" link.
- Results respect role-based visibility (a staff user never sees other staff's data in results).
- Implementation: Postgres full-text search (tsvector) on relevant columns; no external search service in v1.

---

### 7.9 Audit Trail

#### FR-AUDIT-1: Audit log

- Admin-only page `/admin/audit`.
- Append-only log capturing: actor, action, target entity (type + id), timestamp, before/after summary where applicable.
- Logged actions:
  - User invited, activated, deactivated, role changed
  - Task created, edited, reassigned, deleted
  - Report deleted, status reopened from `approved`
  - Template created, edited, archived
  - Attachment deleted
  - Sign-in failures (rate-limit hits)
  - "Sign out everywhere" invocations
- Filters: actor, action type, date range.
- CSV export of filtered log.
- Retention: indefinite (legally / operationally important).

---

### 7.10 PWA & Offline Behavior

#### FR-PWA-1: Installable on mobile

- Web app manifest (name, icons, theme color, display: standalone).
- Service worker registered.
- Pass Lighthouse PWA installability checks.
- Browser prompts "Add to home screen" on supported devices.

#### FR-PWA-2: Offline-tolerant read

- Cache strategy: stale-while-revalidate for app shell, network-first with cache fallback for API reads.
- The following data is cached on each load so it's available offline:
  - Current user's open tasks (last 50)
  - Active report templates available to current user
  - Recent notifications (last 20)
- Offline UI shows a banner "You're offline — showing the last data we fetched."

#### FR-PWA-3: Offline report drafts

- Reports being drafted are saved to IndexedDB every 10 seconds.
- If submission is attempted offline, the report is queued.
- On reconnect, queued reports are submitted in order; user is shown success/error per item.

#### FR-PWA-4: Push notification support

- Service worker handles push events and renders system notifications.
- Tapping a notification opens (or focuses) the app to the relevant deep link.

---

## 8. Extended Scope (post-v1 candidates)

Listed without commitment. Build team should design v1 schemas with these in mind so adding them later doesn't require migrations.

- Recurring tasks (auto-create on schedule)
- Multi-step approval workflows for reports
- Drag-and-drop report-template field designer in UI (v1 templates may be admin-edited via a simpler form or seeded via DB)
- Bulk operations (assign one task to many; bulk export)
- CSV / PDF export of any filtered list
- Calendar view of tasks
- Tags / labels across tasks and reports
- Activity feed page per user
- Charts: completion rate by staff/program, average task duration, report turnaround
- Public read-only share links for individual approved reports
- SSO (Google Workspace, Microsoft) via Better Auth providers
- Native iOS / Android wrappers (only if PWA proves insufficient)
- Time tracking integration
- API + webhooks

---

## 9. Non-Functional Requirements

### 9.1 Accessibility

- Target: **WCAG 2.1 Level AA** compliance for all user-facing pages.
- All interactive elements reachable via keyboard with visible focus.
- Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components.
- Form fields have associated labels; error messages are programmatically associated and announced.
- Images have meaningful `alt` text; decorative images use empty alt.
- Headings follow logical hierarchy.
- Tested with: axe DevTools, keyboard-only walkthrough, VoiceOver (macOS / iOS), TalkBack (Android) on critical flows.

### 9.2 Performance

Budgets (measured on a Moto G4 throttled to slow-4G simulation):

| Metric | Target |
|---|---|
| Largest Contentful Paint | ≤ 2.5 s |
| First Input Delay / INP | ≤ 200 ms |
| Cumulative Layout Shift | ≤ 0.1 |
| Time to Interactive | ≤ 4 s |
| Initial JS payload (gzipped) | ≤ 150 KB |

Strategies: SvelteKit server-side rendering, code splitting per route, image optimization via Cloudinary transformations, careful client-side hydration.

### 9.3 Security

- Authentication, session storage, and password handling delegated to Better Auth (see § 14.3).
- All routes protected server-side; client-side checks are convenience only, never authoritative.
- RBAC enforced in server load functions and form actions (see § 12).
- CSRF protection on state-changing actions (SvelteKit + Better Auth defaults).
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Database access through Prisma with parameterized queries (no raw concatenation).
- File uploads scoped to Cloudinary signed presets; types restricted; sizes enforced.
- HTTPS only (enforced by Vercel).
- Content Security Policy headers set (default-src self; whitelist Cloudinary, email tracker if any).
- Rate limiting on sign-in, password reset, and invitation acceptance.
- Sensitive actions (role change, deactivation, hard-delete) require confirmation step.
- Dependency scanning via Dependabot or equivalent.
- Annual review of OWASP Top 10 against the codebase.

### 9.4 Privacy & Data Retention

- Staff personal data (phone, address, photo) visible only to the staff member, their manager, and admins.
- Deactivated users retained indefinitely for historical record; admin can hard-delete with explicit confirmation (logged).
- Reports and tasks retained indefinitely.
- Audit log retained indefinitely.
- Backups: Neon's point-in-time recovery (7-day window on free plans; longer on paid).
- Data export: any user can request a JSON export of their own data via a "Download my data" link (delivered async via email).
- Data location: Neon region to be set during provisioning (recommendation: closest region to ADSAT's primary location — to confirm during setup; see open question #5).

### 9.5 Internationalization

- All user-facing copy passed through a single dictionary module (no hard-coded strings in components).
- English (en) at launch; structure ready for additional locales (e.g. French) without code changes.
- Date / time / number formatting via `Intl` APIs respecting user locale + time zone.

### 9.6 Browser & Device Support

| Class | Support level |
|---|---|
| Latest 2 versions of Chrome, Edge, Firefox, Safari (desktop) | First-class |
| Latest 2 versions of Chrome / Safari on Android / iOS | First-class |
| Older mobile browsers (Android WebView ≥ 110) | Best-effort |
| Internet Explorer 11 | Not supported |

Min viewport: 360 × 640 (mobile portrait).

### 9.7 Observability

- Server-side logs aggregated via Vercel logs (request/response, errors, key business events).
- Client-side error reporting via Sentry (or Vercel's built-in error monitoring) — to confirm during setup.
- Uptime monitoring on the production URL with email alert on downtime > 2 min.

---

## 10. Information Architecture

Top-level navigation (visible per role):

```
/                          → redirects to /dashboard (auth) or /sign-in (anon)
/sign-in
/forgot-password
/reset-password/[token]
/accept-invite/[token]

/dashboard                 → role-aware dashboard (FR-DASH-*)

/tasks                     → "My Tasks" (Staff) or "Team Tasks" (Manager/Admin)
/tasks/new                 → create task (Manager/Admin)
/tasks/[id]                → task detail

/reports                   → "My Reports" (Staff) or "Team Reports" (Manager/Admin)
/reports/new               → pick template, submit report (Staff)
/reports/[id]              → report detail

/staff                     → directory (Admin sees all, Manager sees team, Staff sees none)
/staff/[id]                → staff member detail
/staff/invite              → invite form (Admin)

/templates                 → list (Admin)
/templates/tasks/[id]      → task template editor (Admin)
/templates/reports/[id]    → report template editor (Admin)

/notifications             → full notification history

/profile                   → my profile + preferences

/admin                     → admin section index
/admin/audit               → audit log (Admin)
/admin/settings            → org settings (Admin)
```

---

## 11. Data Model (High-level)

This is conceptual, not the final Prisma schema. The build team will refine during implementation.

### 11.1 Core entities

- **User** — id, email, name, phone, photoUrl, role (`admin` | `manager` | `staff`), departmentId, timeZone, isActive, createdAt, updatedAt, lastSignInAt
- **Department** (a.k.a. Program) — id, name, description, isActive
- **Account / Session / VerificationToken** — managed by Better Auth (its schema is generated; we adopt it)
- **TaskTemplate** — id, name, description, defaultPriority, departmentId, dueDateOffsetDays, isArchived
- **Task** — id, title, description (rich text), assigneeId, assignerId, dueDate, priority, status, departmentId, templateId (nullable), createdAt, updatedAt, completedAt, deletedAt
- **TaskStatusEvent** — id, taskId, fromStatus, toStatus, actorId, at, note
- **TaskComment** — id, taskId, authorId, body, createdAt, editedAt, deletedAt
- **ReportTemplate** — id, name, description, departmentId, reviewerRole, version, isActive, createdAt
- **ReportField** — id, templateId, label, fieldType, helpText, isRequired, displayOrder, configJson (type-specific config: options, min/max, etc.)
- **Report** — id, templateId, templateVersion, authorId, reviewerId, status, taskId (nullable, FR-REP-9), submittedAt, reviewedAt, createdAt, updatedAt
- **ReportFieldValue** — id, reportId, fieldId, valueText, valueNumber, valueDate, valueJson (multi-select / geo / etc.)
- **ReportComment** — id, reportId, authorId, body, createdAt
- **Attachment** — id, ownerType (`task` | `task_comment` | `report` | `report_comment` | `user_photo`), ownerId, cloudinaryPublicId, secureUrl, mimeType, sizeBytes, originalFilename, uploadedById, createdAt
- **Notification** — id, recipientId, type, title, body, deepLink, readAt, createdAt
- **NotificationPreference** — id, userId, channel, eventCategory, isEnabled, quietHoursStart, quietHoursEnd
- **AuditLog** — id, actorId, action, targetType, targetId, beforeJson, afterJson, createdAt

### 11.2 Key relationships

- User N–1 Department.
- Task N–1 User (assignee), N–1 User (assigner), N–1 TaskTemplate (optional), N–1 Department (optional).
- ReportTemplate 1–N ReportField. Report N–1 ReportTemplate (with version pinning).
- Report 1–N ReportFieldValue (one per field at submit time).
- Attachment polymorphic via (ownerType, ownerId).
- Notification N–1 User.
- AuditLog references actor and target generically.

### 11.3 Indexes (planning hints)

- Task: (assigneeId, status), (dueDate), (assignerId).
- Report: (authorId, status), (reviewerId, status), (templateId, submittedAt desc).
- Notification: (recipientId, createdAt desc), partial index where readAt is null.
- Full-text search indexes on Task.title/description, Report (via ReportFieldValue.valueText), TaskComment.body, ReportComment.body.

---

## 12. Role-Based Access Control Matrix

`R` = read, `W` = write/create, `U` = update, `D` = delete. Empty = not permitted.

| Action / Resource | Admin | Manager | Staff |
|---|---|---|---|
| **User accounts** | R W U D | R (team) | R (self) U (self profile) |
| **Invite user** | W | — | — |
| **Change role** | U | — | — |
| **Deactivate user** | U | — | — |
| **Department / program** | R W U D | R | R |
| **Task template** | R W U D | R | R |
| **Task — own** | R W U D | R W U | R U (status only) |
| **Task — assigned to me** | n/a | R W U | R U (status only) |
| **Task — team** | R W U D | R W U | — |
| **Task — all** | R W U D | — | — |
| **Task comment** | R W U(15min) D | R W U(15min) | R W U(15min) |
| **Reassign task** | U | U (team) | — |
| **Report template** | R W U archive | R | R |
| **Report — own (author)** | R W | R W | R W |
| **Report — team submissions** | R U (review) | R U (review for team) | — |
| **Report — all** | R | — | — |
| **Report comment** | R W | R W | R W |
| **Attachment — upload** | W | W | W |
| **Attachment — delete** | D (any) | D (own) | D (own) |
| **Search** | All scope | Team scope | Self scope |
| **Notifications** | R (own) U | R (own) U | R (own) U |
| **Audit log** | R, export | — | — |
| **Org settings** | R W | — | — |

RBAC is enforced **server-side** in every SvelteKit load function and form action.

---

## 13. Key User Flows

### 13.1 Admin invites a new staff member

1. Admin navigates to `/staff/invite`.
2. Enters name, email, role (Staff), department.
3. Submits → system creates a `pending` user record + invitation token + sends email.
4. Admin sees the new entry in the directory marked "Invited — link sent."
5. Invitee receives email, clicks link → `/accept-invite/[token]`.
6. Sets password; on success, signed in and redirected to `/dashboard`.
7. Audit log: `user.invited` + later `user.activated`.

### 13.2 Manager assigns a task

1. Manager opens `/tasks/new` (or starts from a template).
2. Picks template (optional) → fields pre-fill.
3. Selects assignee from a typeahead (limited to team).
4. Sets due date, priority; attaches a brief.
5. Submits → task created with status `assigned`.
6. Assignee receives in-app + email notifications.
7. Task visible in assignee's "My Tasks" within seconds.

### 13.3 Staff submits a report

1. Staff opens `/reports/new`.
2. Picks template (filtered to their department).
3. Fills fields; uploads two photos via drag-and-drop; auto-save draft.
4. Hits Submit → status moves to `submitted`; reviewer notified.
5. Reviewer opens report from notification; reviews; adds comment; clicks Approve.
6. Author receives "report approved" notification.

### 13.4 Manager requests a revision

1. Manager opens a submitted report from their queue.
2. Reads, identifies missing details.
3. Clicks "Request revision" → modal requires a comment ("please add the beneficiary count").
4. Submits → status moves to `needs_revision`; author notified.
5. Author opens, edits fields, resubmits → back to `submitted`.

### 13.5 Install the PWA on a phone

1. Staff opens the production URL in mobile Chrome / Safari.
2. After a few seconds (or via menu → "Add to Home Screen"), install prompt appears.
3. Staff accepts → app icon on home screen; opens in standalone mode (no browser UI).
4. App functions identically to web; first opens cache the app shell + the user's tasks.

### 13.6 Recover a forgotten password

1. User clicks "Forgot password?" on `/sign-in`.
2. Enters email; submits.
3. Receives email with reset link.
4. Opens link → sets new password.
5. All previous sessions are invalidated; user is signed in fresh.

---

## 14. Tech Stack & Architecture

### 14.1 Frontend / app framework

- **Svelte 5** (with runes) + **SvelteKit** (Node.js adapter for Vercel).
- File-based routing; server load functions for data fetching; form actions for mutations.
- Server-rendered for first paint; progressive enhancement; client-side navigation after hydration.
- TypeScript across the codebase (`strict: true`).

### 14.2 UI components & styling

- **shadcn-svelte** as the component primitives library (https://shadcn-svelte.com).
- **Tailwind CSS** for utility-first styling and design tokens.
- **lucide-svelte** for iconography.
- Theme: a light theme at launch; dark theme as a stretch (CSS variables ready).

### 14.3 Authentication

- **Better Auth** (https://better-auth.com/docs/installation) handles:
  - Email + password sign-in
  - Session management (cookie-based)
  - Password reset flow
  - Account invitations (custom flow built on Better Auth user creation + token issuance)
  - Future: SSO providers (Google, Microsoft) — config-only addition
- Adapter: Better Auth's Prisma adapter so its tables live in the same Neon database as application data.
- Integration with SvelteKit via `+server.ts` route handlers and a `hooks.server.ts` that populates `event.locals.user` from the session cookie on every request.
- All protected routes use a server-side guard pattern (see § 15.1).

### 14.4 Database & ORM

- **Neon Postgres** provisioned via the Vercel Marketplace.
- **Prisma ORM** for schema, migrations, and queries.
- Migrations checked into the repo; `prisma migrate deploy` runs on Vercel build.
- Connection pooling via Neon's built-in pooler (PgBouncer) — use the pooled connection string for the app, direct connection string for migrations.
- Schema split across logical files where helpful (Prisma supports multi-file schemas).

### 14.5 Media & file storage

- **Cloudinary** for all user-uploaded images and files.
- Frontend uploads use **signed upload presets** — the SvelteKit server endpoint signs the upload params using the Cloudinary API secret, and the browser uploads the bytes directly to Cloudinary. Our server never proxies the file content.
- Stored references: `public_id`, `secure_url`, mime, size, original filename.
- Image transformations (thumbnails, responsive images) handled by Cloudinary URL parameters at render time — no pre-generation.
- Access control for v1: rely on the unguessable `public_id` and require an authenticated session to access the URL via our app; v2 may move to fully signed delivery URLs for stricter access control.

### 14.6 Email

- **Resend** (recommended) for transactional emails. Reasons: simple SvelteKit integration, React/Svelte email template support, generous free tier.
- Sender domain to be confirmed (open question #3). DNS records (SPF, DKIM, DMARC) required.
- Templates authored as Svelte components → rendered to HTML at send time.

### 14.7 Hosting & infrastructure

- **Vercel** for hosting (SvelteKit adapter, Fluid Compute by default).
- Single project, one production environment + preview environments per pull request.
- Environment variables managed via `vercel env`; secrets are never committed.
- **Vercel Cron** for scheduled jobs:
  - Daily 7:30 local time per region: due-tomorrow reminders, overdue reminders.
  - Hourly: recurring task generator (when feature lands post-v1).
- **Vercel Web Analytics** (optional) for basic page-view metrics; no third-party trackers.

### 14.8 Repository & tooling

- Single repo (monorepo not needed at this scale).
- Package manager: **pnpm**.
- Linting: ESLint + `eslint-plugin-svelte`.
- Formatting: Prettier with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`.
- Type-checking: `svelte-check`.
- Testing:
  - Unit: Vitest.
  - E2E: Playwright on critical flows (sign-in, assign task, submit report, request revision, install PWA).
- CI: GitHub Actions (or Vercel's built-in checks) — run lint, type-check, unit tests on every PR; Playwright on main.

---

## 15. Architecture Patterns

### 15.1 Authentication guard pattern

In `hooks.server.ts`:

- On every request, read the session cookie, validate via Better Auth, and attach `event.locals.user` (or null).
- A `+layout.server.ts` in `/(app)` (authenticated route group) redirects to `/sign-in` if no user.
- A `+layout.server.ts` in `/(app)/admin` further requires `user.role === 'admin'`.
- All form actions explicitly assert role/ownership before mutation.

### 15.2 Data fetching pattern

- Each route's `+page.server.ts` exposes a `load` function that returns exactly the data the page needs (no over-fetching).
- Mutations happen exclusively in form actions (`+page.server.ts` `actions` export), which:
  - Validate input with **zod**.
  - Authorize the actor.
  - Execute the change via Prisma.
  - Write audit log entry if applicable.
  - Enqueue notifications.
  - Return success/error to the page.

### 15.3 Notification dispatch pattern

- A `notifyService` module exposes `notify({ recipientId, type, payload })`.
- It writes a `Notification` row immediately (in-app delivery).
- It checks the recipient's `NotificationPreference` for email and push channels.
- For email, it calls Resend (fire-and-forget with retry).
- For push, it looks up registered push subscriptions and dispatches via the Web Push protocol.
- All side-effects are wrapped in `try/catch` so a failed email doesn't break the user-facing transaction.

### 15.4 Cloudinary signed upload pattern

- Browser requests `/api/uploads/sign` (POST) with intended folder + tags.
- Server validates the request (must be authenticated), computes a signature using Cloudinary's `api_secret`, returns the signed params.
- Browser uses Cloudinary's JS SDK (or a plain `fetch` to Cloudinary's REST API) to upload directly to Cloudinary.
- Cloudinary returns the `public_id`, `secure_url`, etc.
- Browser sends those values back to our app (`POST /api/attachments`) which stores the reference linked to the parent entity.

---

## 16. Integrations Summary

| Concern | Service | Notes |
|---|---|---|
| Database | Neon Postgres | Vercel Marketplace integration; env vars auto-provisioned. |
| Auth | Better Auth | npm package; Prisma adapter; tables in the same DB. |
| File / image storage | Cloudinary | Direct browser uploads via signed presets. |
| Transactional email | Resend (recommended) | Or Postmark/SendGrid if client preference. DNS setup required. |
| Push notifications | Web Push (browser-native) | No third-party SaaS needed. VAPID keys generated and stored as env vars. |
| Hosting / serverless | Vercel | SvelteKit adapter; Fluid Compute. |
| Scheduled jobs | Vercel Cron | Configured in `vercel.ts` or `vercel.json`. |
| Error monitoring | Sentry or Vercel observability | To confirm during setup. |
| Domain | TBD | Open question #2. |

---

## 17. PWA Specifics

- **Manifest** (`/manifest.webmanifest`):
  - `name`: ADSAT Staff Operations Platform
  - `short_name`: ADSAT Ops
  - `start_url`: `/dashboard`
  - `display`: `standalone`
  - `theme_color`, `background_color`: per brand (open question #1)
  - Icons: 192x192, 512x512 (maskable variants included)
- **Service worker** (`/service-worker.js`):
  - Built via `@vite-pwa/sveltekit` or SvelteKit's native service worker support.
  - Pre-caches the app shell.
  - Runtime-caches API GETs to scoped endpoints (own tasks, templates, notifications) with stale-while-revalidate.
  - Handles `push` and `notificationclick` events.
- **Offline page** at `/offline` for navigations that fall through the cache.
- **Background sync**: on `online` event, replays queued report submissions and POSTs them in order, then refreshes the relevant pages.
- **Install prompt**: deferred and surfaced via a contextual banner ("Install for offline use") rather than the default browser banner, to give the user control.

---

## 18. Success Metrics

Measurable indicators for the first 90 days post-launch. We will revisit targets after one month of real data.

| Metric | Target | How measured |
|---|---|---|
| Weekly active users | ≥ 80% of active staff use the app at least once per week | Sign-in events |
| Task completion on time | ≥ 70% of tasks completed by their due date | Computed from task data |
| Report submission within SLA | ≥ 80% of expected reports submitted by their template's SLA | Computed |
| Median report review turnaround | ≤ 48 hours | Computed |
| Server error rate | ≤ 0.5% of requests | Vercel / Sentry |
| PWA install rate (mobile users) | ≥ 50% of mobile staff install within 4 weeks | `appinstalled` event tracked |
| Stakeholder satisfaction | Director reports the platform has reduced operational overhead | Qualitative review at 30, 60, 90 days |

---

## 19. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Better Auth is younger than NextAuth / Lucia — fewer community recipes for edge cases | Med | Med | Stick to documented patterns; budget time for auth-specific testing; have fallback plan to swap auth provider if a critical blocker is hit. |
| Cloudinary free-tier transformation / storage limits exceeded | Low–Med | Low | Monitor monthly usage; upgrade tier if needed; pre-set transformations economically (a few breakpoints, not on-demand random sizes). |
| Low-bandwidth field use makes the app feel slow | Med | High | Aggressive code splitting, PWA caching, image-size budgets, offline drafts. Real-device testing on throttled networks. |
| Push notification support inconsistent on iOS Safari | High | Low | Web Push on iOS works only for installed PWAs and only on iOS 16.4+. Communicate this clearly; fall back to email + in-app for unsupported devices. |
| Schema changes after launch break offline drafts | Med | Med | Version offline-cached drafts; migrate or discard incompatible drafts with user notice. |
| Single admin (director) becomes a bottleneck for setup | Med | Low | Provide a clear onboarding checklist; consider a "co-admin" feature post-v1 if needed. |
| Email deliverability issues at launch (new sender domain) | Med | Med | Configure SPF, DKIM, DMARC before launch; warm up sending; use Resend's reputation. |
| Data residency concerns from client | Low | Med | Confirm Neon region during setup (open question #5). Document where data lives. |

---

## 20. Open Questions

Pending client input before / during implementation:

1. **Branding** — Does ADSAT have a logo, color palette, or brand kit we should follow? If not, may we propose one for approval?
2. **Domain** — What URL should the app live at? E.g. `app.adsatdevelopmentservices.com`. Does the client have DNS access?
3. **Email sender domain** — From what email address will notifications be sent? (DNS configuration required for SPF/DKIM/DMARC.)
4. **Languages** — English only at launch, correct?
5. **Data residency** — Any constraint on where data is hosted (e.g. Africa, EU, US)? Drives Neon region selection.
6. **Seed templates** — Can ADSAT supply 2–3 example report templates from current programs so v1 launches with real content?
7. **Pilot users** — Can we identify 2–3 staff for usability testing before full rollout?
8. **Existing user list** — Will all current staff be migrated in at launch, or rolled out gradually?
9. **Admin training & support** — Will the director self-serve from docs/video, or do they want a live walkthrough session?

---

## 21. Glossary

| Term | Definition |
|---|---|
| **Admin** | A user with full platform access. Typically the director. |
| **Manager** | A user who can assign tasks and review reports for their team. |
| **Staff** | A user who receives tasks and submits reports. |
| **Department / Program** | A grouping that scopes templates and reporting (e.g. "Community Outreach", "Engineering Services"). |
| **Task** | A unit of work assigned to a single staff member with a status lifecycle. |
| **Task template** | A reusable shape for tasks repeated across a program. |
| **Report** | A structured submission from a staff member, filling out fields defined by a report template. |
| **Report template** | A configurable form definition (fields, types, required flags) used to standardize reporting. |
| **Attachment** | A file or image associated with a task, report, or comment, stored in Cloudinary. |
| **Notification** | A message delivered to a user via in-app, email, or push channels. |
| **Audit log** | An admin-visible record of sensitive actions taken in the system. |
| **PWA** | Progressive Web App — installable on mobile home screens with offline capabilities. |
| **RBAC** | Role-Based Access Control. |
| **SLA** | Service-Level Agreement; here, the expected window for a given event (e.g. report review turnaround). |

---

## Appendix A: Initial Roadmap Hooks (informative, non-binding)

To help with downstream planning, here are sensible build-order groupings. Phasing and dates will be set in the implementation plan, not here.

1. **Foundation** — Project scaffold, Better Auth, Neon + Prisma, base layout, shadcn-svelte set up, sign-in/sign-out, invitation flow.
2. **Users & RBAC** — Staff directory, profile, role guards, admin actions.
3. **Tasks** — Task CRUD, status lifecycle, comments, "My Tasks" and "Team Tasks" views, task templates.
4. **Reports** — Report templates (admin form for v1; visual builder later), report submission, review workflow, comments.
5. **Notifications** — In-app center, email transactional, preference center.
6. **Attachments** — Cloudinary signed uploads, render in tasks/reports/comments.
7. **Dashboards & Search** — Role dashboards, global search.
8. **PWA & Offline** — Manifest, service worker, offline tasks read, offline report drafts.
9. **Audit & Polish** — Audit log UI, accessibility audit, performance budget enforcement, security review.
10. **Pilot & Launch** — Seed templates, pilot user onboarding, training material, production cut-over.

---

*End of document.*
