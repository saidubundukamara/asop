import crypto from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import { directoryScope } from '$lib/server/rbac';
import type { Actions, PageServerLoad } from './$types';
import type { Prisma } from '@prisma/client';

// FR-USER-1 — Staff directory. Admin sees all users; manager sees same-
// department only; staff get bounced to /profile (they have no directory).
//
// FR-USER-2 (list-level prep) handled here too — the page renders the
// table/card list. /staff/[id] handles the detail view.
//
// FR-AUTH-2 — Admin-invited account creation. The invite form action ports
// scripts/seed-invite.ts: create user with throwaway password, upgrade role,
// audit, then trigger a Better Auth password-reset email that lands the
// invitee on /accept-invite.

const PAGE_SIZE = 25;

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const scope = directoryScope(user);

	if (scope === 'self') {
		// Staff have no directory access (PRD § 12 "User accounts" row). Send them
		// to /profile so they can edit their own data instead.
		throw redirect(302, '/profile');
	}

	const { url } = event;
	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
	const roleFilter = url.searchParams.get('role');
	const departmentFilter = url.searchParams.get('department');
	const statusFilter = url.searchParams.get('status');
	const q = (url.searchParams.get('q') ?? '').trim();

	const where: Prisma.UserWhereInput = {};
	if (scope === 'team') {
		// Manager scope: only same department. A manager without a department
		// sees no one — by design (don't leak unassigned users).
		where.departmentId = user.departmentId ?? '___none___';
	}
	if (roleFilter && ['admin', 'manager', 'staff'].includes(roleFilter)) {
		where.role = roleFilter;
	}
	if (departmentFilter) {
		where.departmentId = departmentFilter === 'none' ? null : departmentFilter;
	}
	if (statusFilter === 'active') where.isActive = true;
	if (statusFilter === 'deactivated') where.isActive = false;
	if (q.length > 0) {
		where.OR = [
			{ name: { contains: q, mode: 'insensitive' } },
			{ email: { contains: q, mode: 'insensitive' } }
		];
	}

	const [users, total, departments] = await Promise.all([
		prisma.user.findMany({
			where,
			orderBy: [{ name: 'asc' }],
			skip: (page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				isActive: true,
				photoUrl: true,
				lastSignInAt: true,
				department: { select: { id: true, name: true } }
			}
		}),
		prisma.user.count({ where }),
		// Managers see only their own department in the filter list — keeps the
		// UI honest about what's reachable.
		prisma.department.findMany({
			where: scope === 'team' ? { id: user.departmentId ?? '___none___' } : undefined,
			orderBy: { name: 'asc' },
			select: { id: true, name: true }
		})
	]);

	return {
		users,
		departments,
		pagination: {
			page,
			pageSize: PAGE_SIZE,
			total,
			pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE))
		},
		filters: { role: roleFilter, department: departmentFilter, status: statusFilter, q },
		canInvite: user.role === 'admin'
	};
};

const inviteSchema = z.object({
	email: z.string().trim().toLowerCase().email('Enter a valid email'),
	name: z.string().trim().min(1, 'Name is required').max(120),
	role: z.enum(['admin', 'manager', 'staff'], { message: 'Pick a role' }),
	departmentId: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null))
});

export const actions: Actions = {
	invite: withAction(inviteSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'user.invite', { type: 'directory' });

		// Re-uses the mechanism proven by scripts/seed-invite.ts (chunk 11): the
		// invite link is a Better Auth password-reset token redirected to
		// /accept-invite. The throwaway password is never shown to the invitee.
		const throwaway = crypto.randomBytes(32).toString('base64url') + '0';

		const existing = await prisma.user.findUnique({ where: { email: input.email } });

		try {
			if (!existing) {
				await auth.api.signUpEmail({
					body: { email: input.email, password: throwaway, name: input.name }
				});

				await prisma.$transaction(async (tx) => {
					const updated = await tx.user.update({
						where: { email: input.email },
						data: {
							name: input.name,
							role: input.role,
							departmentId: input.departmentId,
							isActive: true
						},
						select: { id: true, email: true, name: true, role: true, departmentId: true }
					});
					await audit(tx, {
						actorId: actor.id,
						action: 'user.invited',
						target: { type: 'user', id: updated.id },
						after: {
							email: updated.email,
							name: updated.name,
							role: updated.role,
							departmentId: updated.departmentId
						}
					});
				});
			}

			// Outside the tx: sends the invite email via the configured transport
			// (dev: console.log; prod: Resend once wired). Better Auth handles
			// token issuance + email send.
			await auth.api.requestPasswordReset({
				body: { email: input.email, redirectTo: '/accept-invite' }
			});
		} catch (err) {
			if (err instanceof APIError) {
				return {
					ok: false as const,
					issues: { email: [err.body?.message ?? 'Could not send invite'] }
				};
			}
			throw err;
		}

		return { ok: true, data: { email: input.email } };
	})
};
