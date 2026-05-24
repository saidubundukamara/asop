import { z } from 'zod';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { prisma } from '$lib/server/db';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

// Department CRUD for admins. The /admin/+layout.server.ts gate already
// enforces admin-only access to this subtree; actions re-assert via requireCan
// so a future route-gate change can't widen this surface silently.

export const load: PageServerLoad = async (event) => {
	requireUser(event);
	const departments = await prisma.department.findMany({
		orderBy: { name: 'asc' },
		include: { _count: { select: { users: true } } }
	});
	return { departments };
};

const nameSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Name is required')
		.max(100, 'Name must be 100 characters or fewer')
});

const idSchema = z.object({ id: z.string().min(1) });

const updateSchema = z.object({
	id: z.string().min(1),
	name: z
		.string()
		.trim()
		.min(1, 'Name is required')
		.max(100, 'Name must be 100 characters or fewer')
});

export const actions: Actions = {
	create: withAction(nameSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'department.create', { type: 'department' });

		const existing = await prisma.department.findUnique({ where: { name: input.name } });
		if (existing) {
			return {
				ok: false as const,
				issues: { name: ['A department with this name already exists'] }
			};
		}

		const dept = await prisma.$transaction(async (tx) => {
			const created = await tx.department.create({ data: { name: input.name } });
			await audit(tx, {
				actorId: actor.id,
				action: 'department.created',
				target: { type: 'department', id: created.id },
				after: { name: created.name }
			});
			return created;
		});

		return { ok: true as const, data: { id: dept.id } };
	}),

	update: withAction(updateSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'department.update', { type: 'department' });

		const before = await prisma.department.findUnique({ where: { id: input.id } });
		if (!before) {
			const issues: Record<string, string[]> = { id: ['Department not found'] };
			return { ok: false as const, issues };
		}

		const nameConflict = await prisma.department.findFirst({
			where: { name: input.name, NOT: { id: input.id } }
		});
		if (nameConflict) {
			const issues: Record<string, string[]> = {
				name: ['A department with this name already exists']
			};
			return { ok: false as const, issues };
		}

		await prisma.$transaction(async (tx) => {
			await tx.department.update({ where: { id: input.id }, data: { name: input.name } });
			await audit(tx, {
				actorId: actor.id,
				action: 'department.updated',
				target: { type: 'department', id: input.id },
				before: { name: before.name },
				after: { name: input.name }
			});
		});

		return { ok: true as const, data: {} };
	}),

	delete: withAction(idSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'department.delete', { type: 'department' });

		const dept = await prisma.department.findUnique({
			where: { id: input.id },
			include: { _count: { select: { users: true } } }
		});
		if (!dept) {
			return { ok: false as const, issues: { id: ['Department not found'] } };
		}

		await prisma.$transaction(async (tx) => {
			await tx.department.delete({ where: { id: input.id } });
			await audit(tx, {
				actorId: actor.id,
				action: 'department.deleted',
				target: { type: 'department', id: input.id },
				before: { name: dept.name, userCount: dept._count.users }
			});
		});

		return { ok: true as const, data: {} };
	})
};
