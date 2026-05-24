import { z } from 'zod';
import { requireUser } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import { prisma } from '$lib/server/db';
import { TIMEZONES } from '$lib/timezones';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const [fresh, notificationPrefs] = await Promise.all([
		prisma.user.findUniqueOrThrow({
			where: { id: user.id },
			select: {
				id: true,
				email: true,
				name: true,
				phone: true,
				photoUrl: true,
				timeZone: true,
				role: true,
				department: { select: { id: true, name: true } }
			}
		}),
		prisma.notificationPreference.findMany({
			where: { userId: user.id },
			select: {
				id: true,
				channel: true,
				eventCategory: true,
				isEnabled: true,
				quietHoursStart: true,
				quietHoursEnd: true,
				timeZone: true,
				pauseUntil: true
			}
		})
	]);

	return { profile: fresh, notificationPrefs };
};

const updateSchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
	// E.164-ish but tolerant — staff numbers vary by country. Empty string clears.
	phone: z
		.string()
		.trim()
		.max(40, 'Phone number is too long')
		.optional()
		.transform((v) => (v ? v : null)),
	timeZone: z.enum(TIMEZONES, { message: 'Pick a time zone' })
});

const prefSchema = z.object({
	channel: z.enum(['in_app', 'email', 'push']),
	eventCategory: z.enum(['task', 'report', 'mention']),
	isEnabled: z
		.string()
		.optional()
		.transform((v) => v === 'true'),
	quietHoursStart: z
		.string()
		.optional()
		.transform((v) => (v ? parseInt(v, 10) : null)),
	quietHoursEnd: z
		.string()
		.optional()
		.transform((v) => (v ? parseInt(v, 10) : null)),
	timeZone: z.string().optional()
});

const pauseSchema = z.object({
	pauseUntil: z
		.string()
		.optional()
		.transform((v) => (v ? new Date(v) : null))
});

const setPhotoSchema = z.object({
	publicId: z.string().min(1).max(200),
	secureUrl: z
		.string()
		.url('Invalid photo URL')
		// Defensive: only accept Cloudinary URLs. Prevents a client from setting
		// photoUrl to any arbitrary URL by hitting this action directly.
		.refine(
			(v) => /^https:\/\/res\.cloudinary\.com\//.test(v),
			'Photo must be hosted on Cloudinary'
		)
});

export const actions: Actions = {
	update: withAction(updateSchema, async (input, event) => {
		const actor = requireUser(event);

		await prisma.$transaction(async (tx) => {
			const before = await tx.user.findUniqueOrThrow({
				where: { id: actor.id },
				select: { name: true, phone: true, timeZone: true }
			});

			const after = await tx.user.update({
				where: { id: actor.id },
				data: { name: input.name, phone: input.phone, timeZone: input.timeZone },
				select: { name: true, phone: true, timeZone: true }
			});

			await audit(tx, {
				actorId: actor.id,
				action: 'user.self_updated',
				target: { type: 'user', id: actor.id },
				before,
				after
			});
		});

		return { ok: true, data: { saved: true } };
	}),

	updateNotificationPref: withAction(prefSchema, async (input, event) => {
		const actor = requireUser(event);

		await prisma.$transaction(async (tx) => {
			await tx.notificationPreference.upsert({
				where: {
					userId_channel_eventCategory: {
						userId: actor.id,
						channel: input.channel,
						eventCategory: input.eventCategory
					}
				},
				update: {
					isEnabled: input.isEnabled,
					quietHoursStart: input.quietHoursStart,
					quietHoursEnd: input.quietHoursEnd,
					timeZone: input.timeZone ?? actor.timeZone ?? 'UTC'
				},
				create: {
					userId: actor.id,
					channel: input.channel,
					eventCategory: input.eventCategory,
					isEnabled: input.isEnabled,
					quietHoursStart: input.quietHoursStart,
					quietHoursEnd: input.quietHoursEnd,
					timeZone: input.timeZone ?? actor.timeZone ?? 'UTC'
				}
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'notification.preference_updated',
				target: {
					type: 'notification_preference',
					id: `${actor.id}:${input.channel}:${input.eventCategory}`
				},
				after: {
					channel: input.channel,
					eventCategory: input.eventCategory,
					isEnabled: input.isEnabled
				}
			});
		});

		return { ok: true, data: { saved: true } };
	}),

	pauseNotifications: withAction(pauseSchema, async (input, event) => {
		const actor = requireUser(event);
		const categories = ['task', 'report', 'mention'] as const;
		const channels = ['in_app', 'email', 'push'] as const;

		await prisma.$transaction(async (tx) => {
			for (const channel of channels) {
				for (const eventCategory of categories) {
					await tx.notificationPreference.upsert({
						where: { userId_channel_eventCategory: { userId: actor.id, channel, eventCategory } },
						update: { pauseUntil: input.pauseUntil },
						create: { userId: actor.id, channel, eventCategory, pauseUntil: input.pauseUntil }
					});
				}
			}
			await audit(tx, {
				actorId: actor.id,
				action: 'notification.preference_updated',
				target: { type: 'notification_preference', id: actor.id },
				after: { pauseUntil: input.pauseUntil }
			});
		});

		return { ok: true, data: { paused: true } };
	}),

	setPhoto: withAction(setPhotoSchema, async (input, event) => {
		const actor = requireUser(event);

		await prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: actor.id },
				data: { photoUrl: input.secureUrl }
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'user.photo_changed',
				target: { type: 'user', id: actor.id },
				after: { publicId: input.publicId }
			});
		});

		return { ok: true, data: { photoUrl: input.secureUrl } };
	})
};
