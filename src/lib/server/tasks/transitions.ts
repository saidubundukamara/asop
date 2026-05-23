import type { TaskStatus } from '@prisma/client';
import type { Role } from '$lib/server/rbac';

// PRD § 7.3.2 / FR-TASK-2 — task status lifecycle.
//
// Encoded as a per-role adjacency map so the UI (renders only allowed buttons
// via `allowedTransitions`) and the server action (rejects illegal moves with
// 403 via `canTransition`) read from one source of truth. Pure module — no
// Prisma / SvelteKit imports — so it's trivially unit-testable.
//
// Reopening a `completed` task is admin-only (FR-REP-2 sets this precedent for
// reports; the plan extends it to tasks so a manager can't quietly undo a sign-off).

export type TransitionActor = { role: Role | string; isAssignee: boolean };

const ALL_STATUSES: readonly TaskStatus[] = [
	'assigned',
	'in_progress',
	'submitted',
	'completed',
	'blocked',
	'cancelled'
];

// Staff (own task) adjacency. Anything not in this map is forbidden for staff.
const STAFF_TRANSITIONS: ReadonlyMap<TaskStatus, ReadonlySet<TaskStatus>> = new Map([
	['assigned', new Set<TaskStatus>(['in_progress', 'blocked'])],
	['in_progress', new Set<TaskStatus>(['assigned', 'submitted', 'blocked'])],
	['blocked', new Set<TaskStatus>(['in_progress'])],
	['submitted', new Set<TaskStatus>()],
	['completed', new Set<TaskStatus>()],
	['cancelled', new Set<TaskStatus>()]
]);

export function canTransition(actor: TransitionActor, from: TaskStatus, to: TaskStatus): boolean {
	if (from === to) return false;
	if (actor.role === 'admin') return true;
	if (actor.role === 'manager') {
		// Manager moves any-to-any within their team EXCEPT reopen-from-completed.
		return from !== 'completed';
	}
	if (actor.role !== 'staff') return false;
	if (!actor.isAssignee) return false;
	return STAFF_TRANSITIONS.get(from)?.has(to) ?? false;
}

export function allowedTransitions(actor: TransitionActor, from: TaskStatus): TaskStatus[] {
	return ALL_STATUSES.filter((to) => canTransition(actor, from, to));
}
