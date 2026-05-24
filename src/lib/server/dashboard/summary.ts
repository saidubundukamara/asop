// Phase 7 — Role-aware dashboard data (FR-DASH-1/2/3).
//
// Composes existing Prisma queries; no new domain models. Each role's payload
// is a discriminated union so the +page.svelte branch stays type-safe.
//
// All counts go through a single Promise.all per role — measured under
// PRD § 9.2's < 1.5s slow-4G dashboard budget.

import { prisma } from '$lib/server/db';
import type { AuthenticatedLocals } from '$lib/server/auth/guards';

type Actor = AuthenticatedLocals['user'];

const NO_DEPT = '___none___';

// --- types ----------------------------------------------------------------

export type SummaryCardData = {
	label: string;
	value: number;
	href: string;
	trend?: { deltaPct: number | null; direction: 'up' | 'down' | 'flat' };
};

export type QuickActionData = {
	label: string;
	href: string;
	icon: 'plus' | 'file-text' | 'check-circle' | 'users' | 'file-cog' | 'shield';
};

export type ActivityItem = {
	key: string;
	icon: 'bell' | 'check' | 'file' | 'user' | 'log' | 'comment';
	title: string;
	body: string;
	href: string | null;
	at: Date;
};

export type DashboardData =
	| {
			role: 'staff';
			cards: SummaryCardData[];
			activity: ActivityItem[];
			quickActions: QuickActionData[];
	  }
	| {
			role: 'manager';
			cards: SummaryCardData[];
			activity: ActivityItem[];
			quickActions: QuickActionData[];
	  }
	| {
			role: 'admin';
			cards: SummaryCardData[];
			activity: ActivityItem[];
			quickActions: QuickActionData[];
	  };

// --- week bounds (pure, exported for unit tests) --------------------------

// Returns the ISO week (Monday → Sunday) containing `now`, plus the prior
// week, all in UTC. Used by FR-DASH-3 trend deltas. Sierra Leone is UTC+0 so
// "UTC week" ≈ "local week" for the v1 deployment.
export function weekBoundsUTC(now: Date = new Date()): {
	thisWeekStart: Date;
	thisWeekEnd: Date;
	prevWeekStart: Date;
	prevWeekEnd: Date;
} {
	// JS getUTCDay: Sunday = 0 … Saturday = 6. Shift so Monday = 0 … Sunday = 6.
	const day = now.getUTCDay();
	const mondayOffset = (day + 6) % 7;
	const thisWeekStart = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset)
	);
	const thisWeekEnd = new Date(thisWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
	const prevWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
	const prevWeekEnd = thisWeekStart;
	return { thisWeekStart, thisWeekEnd, prevWeekStart, prevWeekEnd };
}

function trendFor(current: number, previous: number): SummaryCardData['trend'] {
	if (previous === 0) {
		if (current === 0) return { deltaPct: 0, direction: 'flat' };
		// Going from 0 → N: percentage isn't meaningful; show an up arrow with null %.
		return { deltaPct: null, direction: 'up' };
	}
	const deltaPct = Math.round(((current - previous) / previous) * 100);
	const direction = deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat';
	return { deltaPct, direction };
}

// --- entry point ----------------------------------------------------------

export async function loadDashboard(actor: Actor): Promise<DashboardData> {
	if (actor.role === 'admin') return loadAdmin();
	if (actor.role === 'manager') return loadManager(actor);
	return loadStaff(actor);
}

// --- staff ----------------------------------------------------------------

async function loadStaff(actor: Actor): Promise<DashboardData> {
	const { thisWeekStart, thisWeekEnd } = weekBoundsUTC();

	const [myOpenTasks, dueThisWeek, reportsNeedingRevision, notifications] = await Promise.all([
		prisma.task.count({
			where: {
				assigneeId: actor.id,
				deletedAt: null,
				status: { notIn: ['completed', 'cancelled'] }
			}
		}),
		prisma.task.count({
			where: {
				assigneeId: actor.id,
				deletedAt: null,
				status: { notIn: ['completed', 'cancelled'] },
				dueDate: { gte: thisWeekStart, lt: thisWeekEnd }
			}
		}),
		prisma.report.count({
			where: { authorId: actor.id, status: 'needs_revision' }
		}),
		prisma.notification.findMany({
			where: { recipientId: actor.id },
			orderBy: { createdAt: 'desc' },
			take: 10,
			select: { id: true, type: true, title: true, body: true, deepLink: true, createdAt: true }
		})
	]);

	return {
		role: 'staff',
		cards: [
			{ label: 'My open tasks', value: myOpenTasks, href: '/tasks?view=my' },
			{ label: 'Due this week', value: dueThisWeek, href: '/tasks?view=my&due=week' },
			{
				label: 'Reports awaiting revision',
				value: reportsNeedingRevision,
				href: '/reports?view=my&status=needs_revision'
			}
		],
		activity: notifications.map((n) => ({
			key: n.id,
			icon: iconForNotificationType(n.type),
			title: n.title,
			body: n.body,
			href: n.deepLink,
			at: n.createdAt
		})),
		quickActions: [{ label: 'Submit a report', href: '/reports/new', icon: 'file-text' }]
	};
}

// --- manager --------------------------------------------------------------

async function loadManager(actor: Actor): Promise<DashboardData> {
	const dept = actor.departmentId ?? NO_DEPT;
	const now = new Date();

	const [teamOpen, teamOverdue, pendingReview, recentSubmissions] = await Promise.all([
		prisma.task.count({
			where: {
				departmentId: dept,
				deletedAt: null,
				status: { notIn: ['completed', 'cancelled'] }
			}
		}),
		prisma.task.count({
			where: {
				departmentId: dept,
				deletedAt: null,
				status: { notIn: ['completed', 'cancelled'] },
				dueDate: { lt: now }
			}
		}),
		prisma.report.count({
			where: {
				status: 'submitted',
				template: { departmentId: dept }
			}
		}),
		// Last 10 reports submitted in this department — FR-DASH-2 "Recent team submissions".
		prisma.report.findMany({
			where: {
				status: { in: ['submitted', 'under_review', 'approved', 'needs_revision'] },
				template: { departmentId: dept }
			},
			orderBy: { submittedAt: 'desc' },
			take: 10,
			select: {
				id: true,
				submittedAt: true,
				createdAt: true,
				status: true,
				author: { select: { name: true } },
				template: { select: { name: true } }
			}
		})
	]);

	return {
		role: 'manager',
		cards: [
			{ label: 'Team open tasks', value: teamOpen, href: '/tasks?view=team' },
			{ label: 'Team overdue', value: teamOverdue, href: '/tasks?view=team&due=overdue' },
			{
				label: 'Pending my review',
				value: pendingReview,
				href: '/reports?view=team&status=submitted'
			}
		],
		activity: recentSubmissions.map((r) => ({
			key: r.id,
			icon: 'file',
			title: r.template.name,
			body: `${r.author?.name ?? 'Unknown'} · ${r.status}`,
			href: `/reports/${r.id}`,
			at: r.submittedAt ?? r.createdAt
		})),
		quickActions: [
			{ label: 'Assign a task', href: '/tasks?action=create', icon: 'plus' },
			{ label: 'Review reports', href: '/reports?view=team&status=submitted', icon: 'check-circle' }
		]
	};
}

// --- admin ----------------------------------------------------------------

async function loadAdmin(): Promise<DashboardData> {
	const { thisWeekStart, thisWeekEnd, prevWeekStart, prevWeekEnd } = weekBoundsUTC();

	const [
		activeUsers,
		openTasks,
		tasksCompletedThisWeek,
		tasksCompletedPrevWeek,
		reportsSubmittedThisWeek,
		reportsSubmittedPrevWeek,
		reportsAwaitingReview,
		auditLogs
	] = await Promise.all([
		prisma.user.count({ where: { isActive: true } }),
		prisma.task.count({
			where: { deletedAt: null, status: { notIn: ['completed', 'cancelled'] } }
		}),
		prisma.task.count({
			where: {
				status: 'completed',
				completedAt: { gte: thisWeekStart, lt: thisWeekEnd }
			}
		}),
		prisma.task.count({
			where: {
				status: 'completed',
				completedAt: { gte: prevWeekStart, lt: prevWeekEnd }
			}
		}),
		prisma.report.count({
			where: { submittedAt: { gte: thisWeekStart, lt: thisWeekEnd } }
		}),
		prisma.report.count({
			where: { submittedAt: { gte: prevWeekStart, lt: prevWeekEnd } }
		}),
		prisma.report.count({ where: { status: 'submitted' } }),
		prisma.auditLog.findMany({
			orderBy: { createdAt: 'desc' },
			take: 20,
			select: {
				id: true,
				action: true,
				targetType: true,
				targetId: true,
				createdAt: true,
				actor: { select: { name: true, email: true } }
			}
		})
	]);

	return {
		role: 'admin',
		cards: [
			{ label: 'Active users', value: activeUsers, href: '/staff' },
			{ label: 'Open tasks', value: openTasks, href: '/tasks?view=all' },
			{
				label: 'Completed this week',
				value: tasksCompletedThisWeek,
				href: '/tasks?view=all&status=completed',
				trend: trendFor(tasksCompletedThisWeek, tasksCompletedPrevWeek)
			},
			{
				label: 'Reports submitted this week',
				value: reportsSubmittedThisWeek,
				href: '/reports?view=team',
				trend: trendFor(reportsSubmittedThisWeek, reportsSubmittedPrevWeek)
			},
			{
				label: 'Reports awaiting review',
				value: reportsAwaitingReview,
				href: '/reports?view=team&status=submitted'
			}
		],
		activity: auditLogs.map((log) => ({
			key: log.id,
			icon: 'log',
			title: humanizeAuditAction(log.action),
			body: `${log.actor?.name ?? log.actor?.email ?? 'system'} · ${log.targetType}`,
			href: deepLinkForAuditTarget(log.targetType, log.targetId),
			at: log.createdAt
		})),
		quickActions: [
			{ label: 'Invite staff', href: '/staff?action=invite', icon: 'users' },
			{ label: 'Create template', href: '/templates/tasks', icon: 'file-cog' },
			{ label: 'View audit log', href: '/admin/audit', icon: 'shield' }
		]
	};
}

// --- helpers --------------------------------------------------------------

function iconForNotificationType(type: string): ActivityItem['icon'] {
	if (type.startsWith('task')) return 'check';
	if (type.startsWith('report')) return 'file';
	if (type.includes('mention') || type.includes('comment')) return 'comment';
	return 'bell';
}

function humanizeAuditAction(action: string): string {
	// "user.invite" → "User invited"; "task.delete" → "Task deleted"
	const [domain, verb] = action.split('.');
	if (!verb) return action;
	const past = verb.endsWith('e') ? verb + 'd' : verb + 'ed';
	const cap = domain.charAt(0).toUpperCase() + domain.slice(1);
	return `${cap} ${past}`;
}

function deepLinkForAuditTarget(targetType: string, targetId: string): string | null {
	switch (targetType) {
		case 'user':
			return `/staff/${targetId}`;
		case 'task':
			return `/tasks/${targetId}`;
		case 'report':
			return `/reports/${targetId}`;
		case 'task_template':
			return `/templates/tasks/${targetId}`;
		case 'report_template':
			return `/templates/reports/${targetId}`;
		default:
			return null;
	}
}
