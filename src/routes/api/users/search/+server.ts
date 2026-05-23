import { error, json } from '@sveltejs/kit';
import type { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import { directoryScope } from '$lib/server/rbac';
import type { RequestHandler } from './$types';

// GET /api/users/search?q=…&scope=team|all
//
// Drives the assignee typeahead inside CreateTaskSheet / ReassignSheet.
// Scope is intersected with the caller's directoryScope() so:
//   - admin can browse anyone (scope param up to admin)
//   - manager always limited to their own department (scope=all is ignored)
//   - staff have no business listing other users → 403
//
// Hard cap of 10 results: this is a typeahead, not a directory.

const MAX_RESULTS = 10;

export const GET: RequestHandler = async (event) => {
	const actor = requireUser(event);
	const scope = directoryScope(actor);
	if (scope === 'self') throw error(403, 'Forbidden');

	const q = (event.url.searchParams.get('q') ?? '').trim();
	const requestedScope = event.url.searchParams.get('scope');

	const where: Prisma.UserWhereInput = { isActive: true };

	// Managers are always team-scoped, regardless of what they ask for.
	// Admins follow their request; default to 'team' if no scope param given so
	// the typeahead suggestions stay narrow by default.
	const effectiveScope: 'team' | 'all' =
		scope === 'team' ? 'team' : requestedScope === 'all' ? 'all' : 'team';

	if (effectiveScope === 'team') {
		// Manager without a department sees no one — same rule as `can('user.read')`.
		where.departmentId = actor.departmentId ?? '___none___';
	}

	if (q.length > 0) {
		where.OR = [
			{ name: { contains: q, mode: 'insensitive' } },
			{ email: { contains: q, mode: 'insensitive' } }
		];
	}

	const users = await prisma.user.findMany({
		where,
		orderBy: [{ name: 'asc' }],
		take: MAX_RESULTS,
		select: {
			id: true,
			name: true,
			email: true,
			photoUrl: true,
			department: { select: { id: true, name: true } }
		}
	});

	return json({ users });
};
