import { z } from 'zod';
import { requireUser } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import { prisma } from '$lib/server/db';
import { TIMEZONES } from '$lib/timezones';
import type { Actions, PageServerLoad } from './$types';

// FR-AUTH-5 — self-service profile editing. Email/role/department are
// admin-only; this page only owns name/phone/timeZone/photoUrl. Notification
// preferences come in Phase 5 alongside the notify pipeline.

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const fresh = await prisma.user.findUniqueOrThrow({
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
	});

	return { profile: fresh };
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
