import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 25;

const pageSchema = z
	.string()
	.optional()
	.transform((v) => Math.max(1, Number(v) || 1));

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	const sp = event.url.searchParams;

	const unreadOnly = sp.get('filter') === 'unread';
	const page = pageSchema.parse(sp.get('page'));
	const skip = (page - 1) * PAGE_SIZE;

	const where = {
		recipientId: actor.id,
		...(unreadOnly ? { readAt: null } : {})
	};

	const [notifications, total, unreadCount] = await Promise.all([
		prisma.notification.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			skip,
			take: PAGE_SIZE,
			select: {
				id: true,
				type: true,
				title: true,
				body: true,
				deepLink: true,
				readAt: true,
				createdAt: true
			}
		}),
		prisma.notification.count({ where }),
		prisma.notification.count({ where: { recipientId: actor.id, readAt: null } })
	]);

	return {
		notifications,
		total,
		page,
		pageSize: PAGE_SIZE,
		totalPages: Math.ceil(total / PAGE_SIZE),
		unreadCount,
		filter: unreadOnly ? 'unread' : 'all'
	};
};

export const actions: Actions = {
	markAllRead: withAction(z.object({}), async (_input, event) => {
		const actor = requireUser(event);
		await prisma.notification.updateMany({
			where: { recipientId: actor.id, readAt: null },
			data: { readAt: new Date() }
		});
		return { ok: true, data: { marked: true } };
	})
};
