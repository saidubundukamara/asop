import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import { directoryScope } from '$lib/server/rbac';
import { sanitizeRichTextCapped } from '$lib/server/sanitize';
import { notify } from '$lib/server/notify';
import { NOTIFICATION_TYPES } from '$lib/server/notifications/types';
import type { Actions, PageServerLoad } from './$types';

// FR-TASK-1 — create a task.
//
// The actual UI lives on /tasks?action=create (CreateTaskSheet). This route
// exists for two reasons:
//   1. The form action `?/create` is mounted here (so the CreateTaskSheet
//      submits to /tasks/new?/create — keeps the create logic off /tasks).
//   2. A bare GET to /tasks/new redirects into the sheet so deep links
//      (e.g. from an email) land in the right place.

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	requireCan(actor, 'task.create', { type: 'task_list' });

	const templateId = event.url.searchParams.get('templateId');
	const target = templateId
		? `/tasks?action=create&templateId=${encodeURIComponent(templateId)}`
		: '/tasks?action=create';
	throw redirect(303, target);
};

const createSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1, 'Title is required')
		.max(140, 'Title is limited to 140 characters'),
	description: z.string().optional().default(''),
	assigneeId: z.string().min(1, 'Assignee is required'),
	dueDate: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	priority: z.enum(['low', 'medium', 'high']).default('medium'),
	departmentId: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	templateId: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null))
});

export const actions: Actions = {
	create: withAction(createSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'task.create', { type: 'task_list' });

		const sanitized = sanitizeRichTextCapped(input.description);
		if (!sanitized.ok) {
			const issues: Record<string, string[]> = { description: ['Description is too long'] };
			return { ok: false as const, issues };
		}

		// Assignee must be active. Managers may only assign within their team —
		// re-check here even though /api/users/search already scopes the picker.
		const scope = directoryScope(actor);
		const assignee = await prisma.user.findFirst({
			where: {
				id: input.assigneeId,
				isActive: true,
				...(scope === 'team' ? { departmentId: actor.departmentId ?? '___none___' } : {})
			},
			select: { id: true, departmentId: true }
		});
		if (!assignee) {
			const issues: Record<string, string[]> = {
				assigneeId: ['Pick an active assignee in scope']
			};
			return { ok: false as const, issues };
		}

		if (input.templateId) {
			const template = await prisma.taskTemplate.findFirst({
				where: { id: input.templateId, isArchived: false },
				select: { id: true }
			});
			if (!template) {
				const issues: Record<string, string[]> = {
					templateId: ['Template is no longer available']
				};
				return { ok: false as const, issues };
			}
		}

		// Date parsing: accept ISO date (YYYY-MM-DD) or ISO datetime. Anything
		// unparseable rejects with a field error rather than silently dropping.
		let dueDate: Date | null = null;
		if (input.dueDate) {
			const d = new Date(input.dueDate);
			if (Number.isNaN(d.getTime())) {
				const issues: Record<string, string[]> = { dueDate: ['Pick a valid date'] };
				return { ok: false as const, issues };
			}
			dueDate = d;
		}

		const created = await prisma.$transaction(async (tx) => {
			const task = await tx.task.create({
				data: {
					title: input.title,
					description: sanitized.html === '' ? null : sanitized.html,
					assigneeId: assignee.id,
					assignerId: actor.id,
					dueDate,
					priority: input.priority,
					// If no explicit department, inherit the assignee's so team views work.
					departmentId: input.departmentId ?? assignee.departmentId,
					templateId: input.templateId,
					status: 'assigned'
				},
				select: { id: true }
			});

			// History event from row zero so the detail page never shows a task
			// with an empty history.
			await tx.taskStatusEvent.create({
				data: {
					taskId: task.id,
					fromStatus: null,
					toStatus: 'assigned',
					actorId: actor.id
				}
			});

			await audit(tx, {
				actorId: actor.id,
				action: 'task.created',
				target: { type: 'task', id: task.id },
				after: {
					title: input.title,
					assigneeId: assignee.id,
					priority: input.priority,
					dueDate: dueDate?.toISOString() ?? null,
					departmentId: input.departmentId ?? assignee.departmentId,
					templateId: input.templateId
				}
			});

			return task;
		});

		// Notify assignee — fire-and-forget, never blocks the response.
		if (assignee.id !== actor.id) {
			notify({
				recipientId: assignee.id,
				type: NOTIFICATION_TYPES.TASK_ASSIGNED,
				title: 'New task assigned',
				body: input.title,
				deepLink: `/tasks/${created.id}`
			}).catch(() => {});
		}
		return { ok: true, data: { id: created.id } };
	})
};
