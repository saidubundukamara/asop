import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import { can } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';

// FR-USER-2 / FR-USER-3 / FR-USER-4 — Staff member detail + admin mutations.
//
// Visibility: admin sees anyone, manager sees same-department, staff sees
// only themselves. Out-of-scope reads return 404, not 403 — we don't leak
// the existence of users outside the actor's directory scope.

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	const { id } = event.params;

	const target = await prisma.user.findUnique({
		where: { id },
		select: {
			id: true,
			email: true,
			name: true,
			role: true,
			phone: true,
			photoUrl: true,
			timeZone: true,
			isActive: true,
			lastSignInAt: true,
			createdAt: true,
			departmentId: true,
			department: { select: { id: true, name: true } }
		}
	});
	if (!target) throw error(404, 'Not found');

	const isSelf = target.id === actor.id;
	if (
		!can(actor, 'user.read', {
			type: 'user',
			id: target.id,
			departmentId: target.departmentId,
			isSelf
		})
	) {
		// Use 404 rather than 403 so we don't reveal that a user with this id
		// exists outside the actor's scope.
		throw error(404, 'Not found');
	}

	const departments =
		actor.role === 'admin'
			? await prisma.department.findMany({
					orderBy: { name: 'asc' },
					select: { id: true, name: true }
				})
			: [];

	return {
		target,
		isSelf,
		canEdit: can(actor, 'user.edit', {
			type: 'user',
			id: target.id,
			departmentId: target.departmentId,
			isSelf
		}),
		canDeactivate: can(actor, 'user.deactivate', {
			type: 'user',
			id: target.id,
			departmentId: target.departmentId,
			isSelf
		}),
		departments
	};
};

const editSchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(120),
	phone: z
		.string()
		.trim()
		.max(40)
		.optional()
		.transform((v) => (v ? v : null)),
	role: z.enum(['admin', 'manager', 'staff'], { message: 'Pick a role' }),
	departmentId: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null))
});

export const actions: Actions = {
	edit: withAction(editSchema, async (input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const before = await prisma.user.findUnique({
			where: { id },
			select: { id: true, name: true, phone: true, role: true, departmentId: true }
		});
		if (!before) throw error(404, 'Not found');

		requireCan(actor, 'user.edit', {
			type: 'user',
			id: before.id,
			departmentId: before.departmentId,
			isSelf: before.id === actor.id
		});

		// Separate change_role check — even an admin must hold the change_role
		// permission to alter role (currently identical, but keeps the matrix
		// honest if "manager edits team but can't promote" ever becomes a case).
		if (input.role !== before.role) {
			requireCan(actor, 'user.change_role', {
				type: 'user',
				id: before.id,
				departmentId: before.departmentId,
				isSelf: before.id === actor.id
			});
		}

		await prisma.$transaction(async (tx) => {
			const after = await tx.user.update({
				where: { id },
				data: {
					name: input.name,
					phone: input.phone,
					role: input.role,
					departmentId: input.departmentId
				},
				select: { name: true, phone: true, role: true, departmentId: true }
			});
			await audit(tx, {
				actorId: actor.id,
				action: input.role !== before.role ? 'user.role_changed' : 'user.edited',
				target: { type: 'user', id: before.id },
				before: {
					name: before.name,
					phone: before.phone,
					role: before.role,
					departmentId: before.departmentId
				},
				after
			});
		});

		return { ok: true, data: { id } };
	}),

	deactivate: withAction(z.object({}), async (_input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const before = await prisma.user.findUnique({
			where: { id },
			select: { id: true, isActive: true, departmentId: true }
		});
		if (!before) throw error(404, 'Not found');

		requireCan(actor, 'user.deactivate', {
			type: 'user',
			id: before.id,
			departmentId: before.departmentId,
			isSelf: before.id === actor.id
		});

		await prisma.$transaction(async (tx) => {
			await tx.user.update({ where: { id }, data: { isActive: false } });
			// Drop all live sessions so the user is logged out everywhere on next
			// request (requireUser also bounces deactivated accounts on load).
			await tx.session.deleteMany({ where: { userId: id } });
			await audit(tx, {
				actorId: actor.id,
				action: 'user.deactivated',
				target: { type: 'user', id: before.id },
				before: { isActive: true },
				after: { isActive: false }
			});
		});

		return { ok: true, data: { id } };
	}),

	reactivate: withAction(z.object({}), async (_input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const before = await prisma.user.findUnique({
			where: { id },
			select: { id: true, isActive: true, departmentId: true }
		});
		if (!before) throw error(404, 'Not found');

		requireCan(actor, 'user.reactivate', {
			type: 'user',
			id: before.id,
			departmentId: before.departmentId,
			isSelf: before.id === actor.id
		});

		await prisma.$transaction(async (tx) => {
			await tx.user.update({ where: { id }, data: { isActive: true } });
			await audit(tx, {
				actorId: actor.id,
				action: 'user.activated',
				target: { type: 'user', id: before.id },
				before: { isActive: false },
				after: { isActive: true }
			});
		});

		return { ok: true, data: { id } };
	})
};
