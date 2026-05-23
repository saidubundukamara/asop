import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import { sanitizeRichTextCapped } from '$lib/server/sanitize';
import type { Actions, PageServerLoad } from './$types';

// FR-TASK-8 — task template detail + edit. Admin-only via parent layout gate.

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	const { id } = event.params;

	const [template, departments] = await Promise.all([
		prisma.taskTemplate.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				defaultDescription: true,
				defaultPriority: true,
				dueDateOffsetDays: true,
				isArchived: true,
				updatedAt: true,
				createdAt: true,
				defaultDepartmentId: true,
				defaultDepartment: { select: { id: true, name: true } },
				createdBy: { select: { id: true, name: true } }
			}
		}),
		prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
	]);

	if (!template) throw error(404, 'Not found');

	return { template, departments, actor: { id: actor.id, role: actor.role } };
};

const updateSchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(120),
	defaultDescription: z.string().optional().default(''),
	defaultPriority: z.enum(['low', 'medium', 'high'], { message: 'Pick a priority' }),
	defaultDepartmentId: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	dueDateOffsetDays: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? Number(v) : null))
		.refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 365), {
			message: 'Offset must be 0–365 days'
		})
});

export const actions: Actions = {
	update: withAction(updateSchema, async (input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		requireCan(actor, 'task_template.update', { type: 'task_template' });

		const before = await prisma.taskTemplate.findUnique({
			where: { id },
			select: {
				name: true,
				defaultDescription: true,
				defaultPriority: true,
				defaultDepartmentId: true,
				dueDateOffsetDays: true
			}
		});
		if (!before) throw error(404, 'Not found');

		const sanitized = sanitizeRichTextCapped(input.defaultDescription);
		if (!sanitized.ok) {
			const issues: Record<string, string[]> = {
				defaultDescription: ['Description is too long']
			};
			return { ok: false as const, issues };
		}

		await prisma.$transaction(async (tx) => {
			const after = await tx.taskTemplate.update({
				where: { id },
				data: {
					name: input.name,
					defaultDescription: sanitized.html === '' ? null : sanitized.html,
					defaultPriority: input.defaultPriority,
					defaultDepartmentId: input.defaultDepartmentId,
					dueDateOffsetDays: input.dueDateOffsetDays
				},
				select: {
					name: true,
					defaultPriority: true,
					defaultDepartmentId: true,
					dueDateOffsetDays: true
				}
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'task_template.updated',
				target: { type: 'task_template', id },
				before: {
					name: before.name,
					defaultPriority: before.defaultPriority,
					defaultDepartmentId: before.defaultDepartmentId,
					dueDateOffsetDays: before.dueDateOffsetDays
				},
				after
			});
		});

		return { ok: true, data: { id } };
	})
};
