import type { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';
import { categoryForType, type NotificationType } from '$lib/server/notifications/types';
import { isInQuietHours } from '$lib/server/notifications/quiet-hours';
import { sendNotificationEmail } from '$lib/server/email/notifications';
import { sendPushNotification } from '$lib/server/push';

export type NotifyInput = {
	recipientId: string;
	type: NotificationType;
	title: string;
	body: string;
	deepLink?: string;
	// Pass the transaction client when calling inside a $transaction so the
	// Notification row rolls back with the parent mutation on failure.
	tx?: Prisma.TransactionClient;
};

export async function notify(input: NotifyInput): Promise<void> {
	const db = input.tx ?? prisma;

	// 1. Write in-app Notification row — always synchronous.
	await db.notification.create({
		data: {
			recipientId: input.recipientId,
			type: input.type,
			title: input.title,
			body: input.body,
			deepLink: input.deepLink
		},
		select: { id: true }
	});

	// 2. Load recipient + preferences for email and push channels.
	const [recipient, prefs] = await Promise.all([
		(input.tx ?? prisma).user.findUnique({
			where: { id: input.recipientId },
			select: { email: true, timeZone: true, isActive: true }
		}),
		(input.tx ?? prisma).notificationPreference.findMany({
			where: { userId: input.recipientId, channel: { in: ['email', 'push'] } }
		})
	]);

	if (!recipient?.isActive) return;

	const category = categoryForType(input.type);
	const now = new Date();

	const emailPref = prefs.find((p) => p.channel === 'email' && p.eventCategory === category);
	const pushPref = prefs.find((p) => p.channel === 'push' && p.eventCategory === category);

	// 3. Fire-and-forget email. Absent pref = opt-out model → enabled.
	const emailEnabled =
		!emailPref || (emailPref.isEnabled && (!emailPref.pauseUntil || emailPref.pauseUntil < now));
	if (emailEnabled) {
		const tz = emailPref?.timeZone ?? recipient.timeZone ?? 'UTC';
		if (!isInQuietHours(now, tz, emailPref?.quietHoursStart, emailPref?.quietHoursEnd)) {
			Promise.resolve()
				.then(() =>
					sendNotificationEmail({
						to: recipient.email,
						recipientId: input.recipientId,
						type: input.type,
						title: input.title,
						body: input.body,
						deepLink: input.deepLink
					})
				)
				.catch((err) =>
					console.error('[notify:email:error]', {
						type: input.type,
						recipientId: input.recipientId,
						err
					})
				);
		}
	}

	// 4. Fire-and-forget push. Absent pref = enabled.
	const pushEnabled =
		!pushPref || (pushPref.isEnabled && (!pushPref.pauseUntil || pushPref.pauseUntil < now));
	if (pushEnabled) {
		const tz = pushPref?.timeZone ?? recipient.timeZone ?? 'UTC';
		if (!isInQuietHours(now, tz, pushPref?.quietHoursStart, pushPref?.quietHoursEnd)) {
			Promise.resolve()
				.then(() =>
					sendPushNotification({
						userId: input.recipientId,
						title: input.title,
						body: input.body,
						deepLink: input.deepLink
					})
				)
				.catch((err) =>
					console.error('[notify:push:error]', {
						type: input.type,
						recipientId: input.recipientId,
						err
					})
				);
		}
	}
}
