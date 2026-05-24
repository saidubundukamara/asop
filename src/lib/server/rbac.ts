// PRD § 12 — Role-Based Access Control matrix as code. This module is the
// single source of truth used by both server guards (load + actions) and UI
// affordance rendering. Keep it pure and free of Prisma / SvelteKit imports
// so it stays trivially unit-testable against the PRD matrix.
//
// Phase 2 encodes only the user-management slice (FR-USER-*). Task, report,
// template, and attachment actions get added when their phases need them —
// per IMPLEMENTATION_PLAN § 5, "add only when a third caller appears."

export type Role = 'admin' | 'manager' | 'staff';

// Narrow shape the matrix actually reads. Anything wider (e.g. App.Locals['user'])
// is assignable to this, so callers don't need to coerce. departmentId is
// declared optional because Better Auth types optional additionalFields as
// optional properties; we normalize internally.
export type RbacUser = {
	id: string;
	role: string;
	departmentId?: string | null;
	isActive: boolean;
};

export type Action =
	| 'user.list'
	| 'user.read'
	| 'user.invite'
	| 'user.edit'
	| 'user.change_role'
	| 'user.deactivate'
	| 'user.reactivate'
	// Phase 3 — tasks. The "team" scope for managers means
	// task.departmentId === actor.departmentId (same rule as user.read).
	| 'task.list'
	| 'task.read'
	| 'task.create'
	| 'task.update_fields'
	| 'task.update_status'
	| 'task.reassign'
	| 'task.delete'
	| 'task.restore'
	| 'task.comment.create'
	// "edit" here means "is the author allowed to edit at all" (the 15-minute
	// window is enforced separately in src/lib/server/tasks/comments.ts).
	| 'task.comment.edit'
	| 'task.comment.delete'
	// Phase 3 — task templates (FR-TASK-8). Admin manages; everyone reads.
	| 'task_template.list'
	| 'task_template.read'
	| 'task_template.create'
	| 'task_template.update'
	| 'task_template.archive'
	// Phase 4 — reports (FR-REP-1..9).
	| 'report.list'
	| 'report.read'
	| 'report.create'
	// Author updates their own draft; admin can always edit.
	| 'report.update_fields'
	// Transition draft → submitted.
	| 'report.submit'
	// Approve or request revision (manager same dept, or admin).
	| 'report.review'
	// Admin-only: reopen an approved report back to submitted.
	| 'report.reopen'
	| 'report.delete'
	| 'report.comment.create'
	| 'report.comment.edit'
	| 'report.comment.delete'
	// Phase 4 — report templates. Admin manages; everyone reads.
	| 'report_template.list'
	| 'report_template.read'
	| 'report_template.create'
	| 'report_template.update'
	| 'report_template.archive'
	// Phase 5 — notifications. All roles, own data only (enforced in load/action).
	| 'notification.list'
	| 'notification.mark_read'
	| 'notification.preference_update'
	// Phase 6 — attachments (FR-FILE-3).
	| 'attachment.delete'
	// Department management — admin-only CRUD.
	| 'department.create'
	| 'department.update'
	| 'department.delete';

export type Resource =
	| { type: 'user'; id: string; departmentId: string | null | undefined; isSelf: boolean }
	| { type: 'directory' }
	// Phase 3 resources. Pass everything the matrix reads; no Prisma inside can().
	| {
			type: 'task';
			assigneeId: string;
			assignerId: string | null;
			departmentId: string | null;
			isCompleted: boolean;
	  }
	| { type: 'task_list' }
	| { type: 'task_comment'; authorId: string | null }
	| { type: 'task_template'; isArchived?: boolean }
	// Phase 4 resources.
	| {
			type: 'report';
			authorId: string;
			// departmentId comes from the template; null means no dept restriction.
			departmentId: string | null;
			status: string;
	  }
	| { type: 'report_list' }
	| { type: 'report_comment'; authorId: string | null }
	| { type: 'report_template' }
	// Phase 5 — notifications.
	| { type: 'notification'; recipientId: string }
	| { type: 'notification_list' }
	// Phase 6 — attachments.
	| {
			type: 'attachment';
			uploadedById: string;
			ownerType: string;
			ownerDepartmentId: string | null;
	  }
	| { type: 'department' };

export type DirectoryScope = 'all' | 'team' | 'self';

// Manager's "team" in v1 = users sharing the same departmentId. If we ever
// introduce a separate Team model, this is the single function to update.
export function directoryScope(user: RbacUser): DirectoryScope {
	if (user.role === 'admin') return 'all';
	if (user.role === 'manager') return 'team';
	return 'self';
}

export function can(user: RbacUser, action: Action, resource: Resource): boolean {
	if (!user.isActive) return false;

	const role = user.role as Role;
	if (role !== 'admin' && role !== 'manager' && role !== 'staff') return false;

	switch (action) {
		case 'user.list':
			// PRD § 12 "User accounts" row — admin sees all, manager sees their team.
			// Staff have no directory access (they get redirected to /profile).
			return role === 'admin' || role === 'manager';

		case 'user.read': {
			if (resource.type !== 'user') return false;
			if (role === 'admin') return true;
			if (resource.isSelf) return true;
			if (role === 'manager') {
				// Manager only sees users in the same department. If either side has
				// no department, treat as not-in-scope (don't fall through to "both
				// null match" because that would leak unassigned users to any manager).
				return Boolean(user.departmentId) && user.departmentId === resource.departmentId;
			}
			return false;
		}

		case 'user.invite':
		case 'user.edit':
		case 'user.change_role':
		case 'user.deactivate':
		case 'user.reactivate':
			// PRD § 12: Invite / Change role / Deactivate rows are admin-only.
			// FR-USER-3 / FR-USER-4 reaffirm: only admin can edit and deactivate.
			return role === 'admin';

		// --- Tasks ---

		case 'task.list':
			// All authenticated roles can hit the list page; the load function
			// narrows the result set per directoryScope() (staff → own only).
			return true;

		case 'task.read': {
			if (resource.type !== 'task') return false;
			if (role === 'admin') return true;
			// Assignee always reads; assigner (creator) always reads.
			if (resource.assigneeId === user.id) return true;
			if (resource.assignerId === user.id) return true;
			if (role === 'manager') {
				// Manager sees team tasks (same department). Without a department
				// they see nothing — same rule as user.read.
				return Boolean(user.departmentId) && user.departmentId === resource.departmentId;
			}
			return false;
		}

		case 'task.create':
			// FR-TASK-1: admin or manager creates tasks. Staff cannot self-assign.
			return role === 'admin' || role === 'manager';

		case 'task.update_fields': {
			if (resource.type !== 'task') return false;
			// FR-TASK-9: edits are closed once the task is completed.
			if (resource.isCompleted) return role === 'admin';
			if (role === 'admin') return true;
			if (role === 'manager') {
				return Boolean(user.departmentId) && user.departmentId === resource.departmentId;
			}
			// Staff cannot edit fields (status-only edits go through update_status).
			return false;
		}

		case 'task.update_status': {
			// Note: the per-transition legality check lives in
			// src/lib/server/tasks/transitions.ts. This gate just answers "is the
			// actor in scope to attempt a status change at all?"
			if (resource.type !== 'task') return false;
			if (role === 'admin') return true;
			if (role === 'manager') {
				return Boolean(user.departmentId) && user.departmentId === resource.departmentId;
			}
			// Staff can only update status of their own tasks.
			return resource.assigneeId === user.id;
		}

		case 'task.reassign': {
			if (resource.type !== 'task') return false;
			if (role === 'admin') return true;
			if (role === 'manager') {
				return Boolean(user.departmentId) && user.departmentId === resource.departmentId;
			}
			return false;
		}

		case 'task.delete':
		case 'task.restore':
			// FR-TASK-9: delete is admin-only (soft). Restore mirrors delete.
			return role === 'admin';

		case 'task.comment.create':
			// Anyone with read access to the parent task can comment (FR-TASK-6).
			// The route must check `task.read` on the parent before calling this.
			return true;

		case 'task.comment.edit': {
			// PRD § 12: comment edit is author-only — even admins can't edit
			// other people's comments. The 15-minute window is enforced in
			// canEditComment() (separate helper).
			if (resource.type !== 'task_comment') return false;
			return resource.authorId === user.id;
		}

		case 'task.comment.delete':
			// PRD § 12: deletion is admin-only and logged.
			return role === 'admin';

		// --- Task templates (FR-TASK-8) ---

		case 'task_template.list':
		case 'task_template.read':
			// All roles can pick from templates when creating a task. Staff
			// don't have a create-task affordance, so they won't reach the
			// picker, but the matrix allows the read.
			return true;

		case 'task_template.create':
		case 'task_template.update':
		case 'task_template.archive':
			return role === 'admin';

		// --- Reports (FR-REP-1..9, PRD § 12) ---

		case 'report.list':
			// All roles can reach the list page; the load function narrows results.
			return true;

		case 'report.read': {
			if (resource.type !== 'report') return false;
			if (role === 'admin') return true;
			if (resource.authorId === user.id) return true;
			if (role === 'manager') {
				// Manager sees reports in their department (via the template dept).
				return Boolean(user.departmentId) && user.departmentId === resource.departmentId;
			}
			return false;
		}

		case 'report.create':
			// All roles can submit reports.
			return true;

		case 'report.update_fields': {
			if (resource.type !== 'report') return false;
			// Only drafts are editable; admin can always touch any draft.
			if (resource.status !== 'draft') return role === 'admin';
			if (role === 'admin') return true;
			return resource.authorId === user.id;
		}

		case 'report.submit': {
			if (resource.type !== 'report') return false;
			if (resource.status !== 'draft' && resource.status !== 'needs_revision') return false;
			if (role === 'admin') return true;
			return resource.authorId === user.id;
		}

		case 'report.review': {
			// Approve or request-revision. Not the author's call.
			if (resource.type !== 'report') return false;
			if (role === 'admin') return true;
			if (role === 'manager') {
				return Boolean(user.departmentId) && user.departmentId === resource.departmentId;
			}
			return false;
		}

		case 'report.reopen':
			// Admin-only: move approved → submitted.
			return role === 'admin';

		case 'report.delete':
			return role === 'admin';

		case 'report.comment.create':
			// Anyone with read access to the parent report can comment.
			return true;

		case 'report.comment.edit': {
			if (resource.type !== 'report_comment') return false;
			return resource.authorId === user.id;
		}

		case 'report.comment.delete':
			return role === 'admin';

		// --- Report templates (FR-REP-5) ---

		case 'report_template.list':
		case 'report_template.read':
			return true;

		case 'report_template.create':
		case 'report_template.update':
		case 'report_template.archive':
			return role === 'admin';

		// --- Notifications (FR-NOTIF-1..4) ---

		case 'notification.list':
			// Own notifications only — enforced in the load function via recipientId filter.
			return true;

		case 'notification.mark_read': {
			if (resource.type !== 'notification') return false;
			return resource.recipientId === user.id;
		}

		case 'notification.preference_update':
			// Own preferences only — load/action enforce userId = actor.id.
			return true;

		// --- Attachments (FR-FILE-3) ---

		case 'attachment.delete': {
			if (resource.type !== 'attachment') return false;
			// Admin can delete any attachment.
			if (role === 'admin') return true;
			// Uploader can remove their own attachment.
			if (resource.uploadedById === user.id) return true;
			// Manager can delete attachments belonging to their team's entities.
			if (role === 'manager') {
				return Boolean(user.departmentId) && user.departmentId === resource.ownerDepartmentId;
			}
			return false;
		}

		// --- Departments (admin-only CRUD) ---

		case 'department.create':
		case 'department.update':
		case 'department.delete':
			return role === 'admin';

		default: {
			const _exhaustive: never = action;
			return _exhaustive;
		}
	}
}
