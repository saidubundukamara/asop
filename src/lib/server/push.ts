import webpush from 'web-push';
import { prisma } from '$lib/server/db';

const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
const privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
const subject = process.env.VAPID_SUBJECT ?? 'mailto:ops@example.com';

// Only set VAPID details when keys are configured (skipped in dev without keys).
if (publicKey && privateKey) {
	webpush.setVapidDetails(subject, publicKey, privateKey);
}

export type PushPayload = {
	userId: string;
	title: string;
	body: string;
	deepLink?: string;
};

// Called fire-and-forget from notify.ts. Removes stale subscriptions (HTTP 410)
// automatically so the table self-prunes over time.
export async function sendPushNotification(payload: PushPayload): Promise<void> {
	if (!publicKey || !privateKey) return;

	const subs = await prisma.pushSubscription.findMany({
		where: { userId: payload.userId },
		select: { id: true, endpoint: true, auth: true, p256dh: true }
	});
	if (subs.length === 0) return;

	const message = JSON.stringify({
		title: payload.title,
		body: payload.body,
		deepLink: payload.deepLink ?? '/'
	});

	await Promise.allSettled(
		subs.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
					message
				);
			} catch (err: unknown) {
				const status = (err as { statusCode?: number }).statusCode;
				if (status === 410 || status === 404) {
					await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
				} else {
					throw err;
				}
			}
		})
	);
}

export function getVapidPublicKey(): string {
	return publicKey;
}
