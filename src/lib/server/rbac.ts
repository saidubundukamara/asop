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
	| 'user.reactivate';

export type Resource =
	| { type: 'user'; id: string; departmentId: string | null | undefined; isSelf: boolean }
	| { type: 'directory' };

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

		default: {
			const _exhaustive: never = action;
			return _exhaustive;
		}
	}
}
