// FR-REP-2 — report status state machine.
//
// Pure functions; no Prisma imports. The RBAC gate (can(user, 'report.review', ...))
// always runs before these helpers — they only answer "is this transition valid
// given the current state and the actor's relationship to the report?"
//
// State machine:
//   draft          → submitted        (author or admin)
//   submitted      → under_review     (reviewer: manager same dept, or admin)
//   under_review   → approved         (reviewer)
//   under_review   → needs_revision   (reviewer)
//   needs_revision → submitted        (author — resubmit)
//   approved       → submitted        (admin only — reopen)

export type ReportStatusValue =
	| 'draft'
	| 'submitted'
	| 'under_review'
	| 'approved'
	| 'needs_revision';

export type ReportLifecycleActor = {
	id: string;
	role: string;
	departmentId?: string | null;
};

export type ReportLifecycleContext = {
	authorId: string;
	departmentId: string | null;
	status: ReportStatusValue;
};

export function canTransitionReport(
	actor: ReportLifecycleActor,
	report: ReportLifecycleContext,
	to: ReportStatusValue
): boolean {
	const role = actor.role;
	const from = report.status;
	const isAuthor = report.authorId === actor.id;
	const isAdmin = role === 'admin';
	const isReviewer =
		isAdmin ||
		(role === 'manager' &&
			Boolean(actor.departmentId) &&
			actor.departmentId === report.departmentId);

	switch (`${from}→${to}`) {
		case 'draft→submitted':
			return isAuthor || isAdmin;

		case 'submitted→under_review':
			return isReviewer;

		case 'under_review→approved':
		case 'under_review→needs_revision':
			return isReviewer;

		case 'needs_revision→submitted':
			return isAuthor || isAdmin;

		// Admin-only reopen (FR-REP-2).
		case 'approved→submitted':
			return isAdmin;

		default:
			return false;
	}
}

// Allowed "next" statuses the actor can move this report to from its current state.
export function allowedTransitions(
	actor: ReportLifecycleActor,
	report: ReportLifecycleContext
): ReportStatusValue[] {
	const all: ReportStatusValue[] = [
		'draft',
		'submitted',
		'under_review',
		'approved',
		'needs_revision'
	];
	return all.filter((to) => to !== report.status && canTransitionReport(actor, report, to));
}
