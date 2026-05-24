import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

const bodySchema = z.object({ endpoint: z.string().url() });

export const DELETE: RequestHandler = async (event) => {
	const actor = requireUser(event);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid request body');

	await prisma.$transaction(async (tx) => {
		await tx.pushSubscription.deleteMany({
			where: { endpoint: parsed.data.endpoint, userId: actor.id }
		});
		await audit(tx, {
			actorId: actor.id,
			action: 'push_subscription.removed',
			target: { type: 'push_subscription', id: parsed.data.endpoint }
		});
	});

	return json({ ok: true });
};
