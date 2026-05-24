import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { audit } from '$lib/server/audit';
import { prisma } from '$lib/server/db';
import type { Actions } from './$types';

const ForgotSchema = z.object({
	email: z.email().max(254)
});

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const raw = { email: String(formData.get('email') ?? '').trim() };
		const parsed = ForgotSchema.safeParse(raw);

		// FR-AUTH-3: always show the same response so we never leak whether the
		// email exists. Don't even surface a "bad email format" error.
		const GENERIC = { sent: true, email: raw.email };

		if (!parsed.success) return GENERIC;

		try {
			await auth.api.requestPasswordReset({
				body: { email: parsed.data.email, redirectTo: '/reset-password' },
				headers: request.headers
			});
		} catch (err) {
			if (err instanceof APIError && err.statusCode === 429) {
				// Phase 9 / FR-AUDIT-1: record rate-limit hits even though the response
				// itself stays generic for enumeration protection. The audit row carries
				// the attempted email so admins can see who's being targeted.
				await prisma.$transaction((tx) =>
					audit(tx, {
						actorId: null,
						action: 'auth.forgot_password_throttled',
						target: { type: 'auth.forgot', id: parsed.data.email }
					})
				);
				return fail(429, {
					email: raw.email,
					message: 'Too many requests. Try again in a few minutes.'
				});
			}
			// Swallow other errors and still show the generic response — auth.ts's
			// sendResetPassword is the only path that should ever throw here, and
			// we already log + swallow inside sendEmail.
		}

		return GENERIC;
	}
};
