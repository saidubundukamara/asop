import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const actor = requireUser(event);
	const notifications = await prisma.notification.findMany({
		where: { recipientId: actor.id },
		orderBy: { createdAt: 'desc' },
		take: 20,
		select: {
			id: true,
			type: true,
			title: true,
			body: true,
			deepLink: true,
			readAt: true,
			createdAt: true
		}
	});
	return json({ notifications });
};
