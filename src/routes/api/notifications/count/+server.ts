import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const actor = requireUser(event);
	const unread = await prisma.notification.count({
		where: { recipientId: actor.id, readAt: null }
	});
	return json({ unread });
};
