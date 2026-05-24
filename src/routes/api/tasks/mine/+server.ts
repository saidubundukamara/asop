import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

// Scoped read endpoint cached by the service worker (Phase 8 runtime caching).
// Returns the assignee's last-50 active tasks so the offline shell can render
// /tasks from cache when there's no network.

export const GET: RequestHandler = async (event) => {
	const actor = requireUser(event);

	const tasks = await prisma.task.findMany({
		where: {
			assigneeId: actor.id,
			deletedAt: null,
			status: { notIn: ['completed', 'cancelled'] }
		},
		orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
		take: 50,
		select: {
			id: true,
			title: true,
			status: true,
			priority: true,
			dueDate: true,
			updatedAt: true,
			assignee: { select: { id: true, name: true, photoUrl: true } },
			department: { select: { id: true, name: true } }
		}
	});

	return json({ tasks });
};
