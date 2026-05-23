import { error } from '@sveltejs/kit';
import type { Prisma, TaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import { can, directoryScope } from '$lib/server/rbac';
import type { PageServerLoad } from './$types';

// FR-TASK-3 / FR-TASK-4 — task list, role-aware (My / Team / All).
// FR-TASK-9 — admin sees soft-deleted under ?filter=trash.

const PAGE_SIZE = 25;

const STATUSES: readonly TaskStatus[] = [
	'assigned',
	'in_progress',
	'submitted',
	'completed',
	'blocked',
	'cancelled'
];
const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];

type View = 'my' | 'team' | 'all';

function pickView(actor: { role: string }, raw: string | null): View {
	if (raw === 'my' || raw === 'team' || raw === 'all') {
		if (raw === 'all' && actor.role !== 'admin') return actor.role === 'manager' ? 'team' : 'my';
		if (raw === 'team' && actor.role === 'staff') return 'my';
		return raw;
	}
	if (actor.role === 'staff') return 'my';
	return 'team';
}

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	const scope = directoryScope(actor);
	const { url } = event;

	const view = pickView(actor, url.searchParams.get('view'));
	const isTrash = url.searchParams.get('filter') === 'trash';
	if (isTrash && actor.role !== 'admin') throw error(403, 'Forbidden');

	const statusParam = url.searchParams.get('status');
	const priorityParam = url.searchParams.get('priority');
	const programParam = url.searchParams.get('program');
	const assigneeParam = url.searchParams.get('assigneeId');
	const dueParam = url.searchParams.get('due');
	const sortParam = url.searchParams.get('sort') ?? 'due';
	const q = (url.searchParams.get('q') ?? '').trim();
	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

	const where: Prisma.TaskWhereInput = isTrash ? { deletedAt: { not: null } } : { deletedAt: null };

	// View scoping. Note: "team" + admin = same as team manager (their dept);
	// admin can opt into "all" to see everything.
	if (view === 'my') {
		where.assigneeId = actor.id;
	} else if (view === 'team') {
		// Manager / admin team view: same-department tasks. A manager without a
		// department sees nothing (same rule as user.read).
		where.departmentId = actor.departmentId ?? '___none___';
	}
	// view === 'all' (admin only) adds no extra scope.

	// Default to "not completed and not cancelled" unless the user picked a
	// specific status filter or asked for trash.
	if (statusParam && (STATUSES as readonly string[]).includes(statusParam)) {
		where.status = statusParam as TaskStatus;
	} else if (!isTrash) {
		where.status = { notIn: ['completed', 'cancelled'] };
	}

	if (priorityParam && (PRIORITIES as readonly string[]).includes(priorityParam)) {
		where.priority = priorityParam as TaskPriority;
	}
	if (programParam) {
		where.departmentId = programParam === 'none' ? null : programParam;
	}
	if (assigneeParam) {
		where.assigneeId = assigneeParam;
	}
	const now = new Date();
	if (dueParam === 'overdue') {
		where.dueDate = { lt: now };
		// Don't flag completed/cancelled tasks as overdue.
		where.status = { notIn: ['completed', 'cancelled'] };
	} else if (dueParam === 'today') {
		const endOfDay = new Date(now);
		endOfDay.setHours(23, 59, 59, 999);
		where.dueDate = { gte: now, lte: endOfDay };
	} else if (dueParam === 'week') {
		const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		where.dueDate = { gte: now, lte: inAWeek };
	}
	if (q.length > 0) {
		where.OR = [
			{ title: { contains: q, mode: 'insensitive' } },
			{ description: { contains: q, mode: 'insensitive' } }
		];
	}

	const orderBy: Prisma.TaskOrderByWithRelationInput[] =
		sortParam === 'priority'
			? // High first; null due dates last.
				[{ priority: 'desc' }, { dueDate: { sort: 'asc', nulls: 'last' } }]
			: sortParam === 'updated'
				? [{ updatedAt: 'desc' }]
				: // default: due date ascending, with nulls last so "no due date" doesn't dominate.
					[{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }];

	// Templates + prefill are loaded here too so the inline CreateTaskSheet
	// on /tasks?action=create has everything it needs (same pattern as
	// /staff loading `departments` for InviteSheet).
	const templateIdParam = url.searchParams.get('templateId');

	const [tasks, total, departments, teamUsers, templates, prefill] = await Promise.all([
		prisma.task.findMany({
			where,
			orderBy,
			skip: (page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
			select: {
				id: true,
				title: true,
				status: true,
				priority: true,
				dueDate: true,
				createdAt: true,
				updatedAt: true,
				deletedAt: true,
				assignee: { select: { id: true, name: true, photoUrl: true } },
				assigner: { select: { id: true, name: true } },
				department: { select: { id: true, name: true } }
			}
		}),
		prisma.task.count({ where }),
		// Programs filter dropdown — managers see their own dept only.
		prisma.department.findMany({
			where: scope === 'team' ? { id: actor.departmentId ?? '___none___' } : undefined,
			orderBy: { name: 'asc' },
			select: { id: true, name: true }
		}),
		// Assignee filter dropdown + create-sheet picker. Up to 50 active users
		// in scope; a true typeahead lives in /api/users/search for the
		// reassign flow on the detail page.
		prisma.user.findMany({
			where: {
				isActive: true,
				...(scope === 'team' ? { departmentId: actor.departmentId ?? '___none___' } : {})
			},
			orderBy: { name: 'asc' },
			take: 50,
			select: { id: true, name: true }
		}),
		// Template list for "Start from template" dropdown — only the active ones.
		prisma.taskTemplate.findMany({
			where: { isArchived: false },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				defaultPriority: true,
				defaultDepartmentId: true,
				dueDateOffsetDays: true
			}
		}),
		// Prefill the create sheet when ?templateId=… is in the URL.
		templateIdParam
			? prisma.taskTemplate.findFirst({
					where: { id: templateIdParam, isArchived: false },
					select: {
						id: true,
						name: true,
						defaultDescription: true,
						defaultPriority: true,
						defaultDepartmentId: true,
						dueDateOffsetDays: true
					}
				})
			: Promise.resolve(null)
	]);

	const canCreate = can(actor, 'task.create', { type: 'task_list' });
	const canSeeTrash = actor.role === 'admin';

	return {
		tasks,
		departments,
		teamUsers,
		templates,
		prefill,
		pagination: {
			page,
			pageSize: PAGE_SIZE,
			total,
			pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE))
		},
		filters: {
			status: statusParam,
			priority: priorityParam,
			program: programParam,
			assigneeId: assigneeParam,
			due: dueParam,
			sort: sortParam,
			q
		},
		view,
		isTrash,
		canCreate,
		canSeeTrash,
		actor: { id: actor.id, role: actor.role, departmentId: actor.departmentId ?? null }
	};
};
