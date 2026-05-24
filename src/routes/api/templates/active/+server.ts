import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import { directoryScope } from '$lib/server/rbac';
import type { RequestHandler } from './$types';

// Scoped read endpoint cached by the service worker (Phase 8 runtime caching).
// Returns active report templates available to the actor so the offline shell
// can render the /reports/new picker from cache.

export const GET: RequestHandler = async (event) => {
	const actor = requireUser(event);
	const scope = directoryScope(actor);

	const templates = await prisma.reportTemplate.findMany({
		where: {
			isActive: true,
			...(scope === 'self' || scope === 'team'
				? {
						OR: [{ departmentId: actor.departmentId ?? undefined }, { departmentId: null }]
					}
				: {})
		},
		orderBy: { name: 'asc' },
		take: 50,
		select: {
			id: true,
			name: true,
			description: true,
			version: true,
			reviewerRole: true,
			department: { select: { id: true, name: true } },
			fields: {
				orderBy: { displayOrder: 'asc' },
				select: {
					id: true,
					label: true,
					fieldType: true,
					helpText: true,
					isRequired: true,
					displayOrder: true,
					configJson: true,
					defaultValue: true
				}
			}
		}
	});

	return json({ templates });
};
