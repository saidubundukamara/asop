import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import { sanitizeRichTextCapped } from '$lib/server/sanitize';
import type { Actions, PageServerLoad } from './$types';

// FR-TASK-8 — Task template admin. List + create + archive/unarchive.
// The /templates/+layout.server.ts gate already ensures actor.role === 'admin',
// but each action re-asserts via requireCan() so a future loosening of the
// route gate can't accidentally widen this surface.

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	const showArchived = event.url.searchParams.get('showArchived') === '1';

	const [templates, departments] = await Promise.all([
		prisma.taskTemplate.findMany({
			where: showArchived ? {} : { isArchived: false },
			orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
			select: {
				id: true,
				name: true,
				defaultPriority: true,
				dueDateOffsetDays: true,
				isArchived: true,
				updatedAt: true,
				defaultDepartment: { select: { id: true, name: true } }
			}
		}),
		prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
	]);

	return {
		templates,
		departments,
		showArchived,
		actor: { id: actor.id, role: actor.role }
	};
};

// HTML in defaultDescription is optional, so allow an empty string to mean
// "no default description". Sanitize-and-cap after coercion.
const createSchema = z.object({
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

const archiveSchema = z.object({ id: z.string().min(1) });

export const actions: Actions = {
	create: withAction(createSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'task_template.create', { type: 'task_template' });

		const sanitized = sanitizeRichTextCapped(input.defaultDescription);
		if (!sanitized.ok) {
			const issues: Record<string, string[]> = {
				defaultDescription: ['Description is too long']
			};
			return { ok: false as const, issues };
		}

		const created = await prisma.$transaction(async (tx) => {
			const tpl = await tx.taskTemplate.create({
				data: {
					name: input.name,
					defaultDescription: sanitized.html === '' ? null : sanitized.html,
					defaultPriority: input.defaultPriority,
					defaultDepartmentId: input.defaultDepartmentId,
					dueDateOffsetDays: input.dueDateOffsetDays,
					createdById: actor.id
				},
				select: { id: true, name: true, defaultPriority: true, defaultDepartmentId: true }
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'task_template.created',
				target: { type: 'task_template', id: tpl.id },
				after: tpl
			});
			return tpl;
		});

		return { ok: true, data: { id: created.id } };
	}),

	archive: withAction(archiveSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'task_template.archive', { type: 'task_template' });

		const before = await prisma.taskTemplate.findUnique({
			where: { id: input.id },
			select: { id: true, isArchived: true }
		});
		if (!before) throw error(404, 'Not found');

		await prisma.$transaction(async (tx) => {
			await tx.taskTemplate.update({ where: { id: input.id }, data: { isArchived: true } });
			await audit(tx, {
				actorId: actor.id,
				action: 'task_template.archived',
				target: { type: 'task_template', id: input.id },
				before: { isArchived: before.isArchived },
				after: { isArchived: true }
			});
		});

		return { ok: true, data: { id: input.id } };
	}),

	unarchive: withAction(archiveSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'task_template.archive', { type: 'task_template' });

		const before = await prisma.taskTemplate.findUnique({
			where: { id: input.id },
			select: { id: true, isArchived: true }
		});
		if (!before) throw error(404, 'Not found');

		await prisma.$transaction(async (tx) => {
			await tx.taskTemplate.update({ where: { id: input.id }, data: { isArchived: false } });
			await audit(tx, {
				actorId: actor.id,
				action: 'task_template.unarchived',
				target: { type: 'task_template', id: input.id },
				before: { isArchived: before.isArchived },
				after: { isArchived: false }
			});
		});

		return { ok: true, data: { id: input.id } };
	})
};
