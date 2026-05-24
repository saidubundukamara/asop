import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

const bodySchema = z.union([
	z.object({ all: z.literal(true) }),
	z.object({ ids: z.array(z.string()).min(1) })
]);

export const POST: RequestHandler = async (event) => {
	const actor = requireUser(event);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid request body');

	const data = parsed.data;
	const now = new Date();

	let count: number;
	if ('all' in data) {
		const result = await prisma.notification.updateMany({
			where: { recipientId: actor.id, readAt: null },
			data: { readAt: now }
		});
		count = result.count;
	} else {
		const result = await prisma.notification.updateMany({
			where: { recipientId: actor.id, id: { in: data.ids }, readAt: null },
			data: { readAt: now }
		});
		count = result.count;
	}

	return json({ ok: true, count });
};
