import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import { getVapidPublicKey } from '$lib/server/push';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

const subscribeSchema = z.object({
	endpoint: z.string().url(),
	keys: z.object({
		auth: z.string(),
		p256dh: z.string()
	})
});

// GET: return VAPID public key for client-side pushManager.subscribe()
export const GET: RequestHandler = async (event) => {
	requireUser(event);
	return json({ vapidPublicKey: getVapidPublicKey() });
};

// POST: register or update a push subscription for the current device
export const POST: RequestHandler = async (event) => {
	const actor = requireUser(event);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = subscribeSchema.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid subscription data');

	const { endpoint, keys } = parsed.data;

	await prisma.$transaction(async (tx) => {
		await tx.pushSubscription.upsert({
			where: { endpoint },
			update: { userId: actor.id, auth: keys.auth, p256dh: keys.p256dh },
			create: { userId: actor.id, endpoint, auth: keys.auth, p256dh: keys.p256dh }
		});
		await audit(tx, {
			actorId: actor.id,
			action: 'push_subscription.registered',
			target: { type: 'push_subscription', id: endpoint }
		});
	});

	return json({ ok: true });
};
