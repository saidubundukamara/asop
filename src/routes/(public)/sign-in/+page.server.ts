import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

const SignInSchema = z.object({
	email: z.email().max(254),
	password: z.string().min(1).max(128)
});

export const load: PageServerLoad = ({ url }) => {
	const reason = url.searchParams.get('reason');
	const next = url.searchParams.get('next');
	const flashes: Record<string, string> = {};
	if (reason === 'deactivated') {
		flashes.notice = 'Your account is deactivated. Contact your administrator.';
	} else if (reason === 'reset') {
		flashes.notice = 'Password reset. Sign in with your new password.';
	}
	return { flashes, next };
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const formData = await request.formData();
		const raw = {
			email: String(formData.get('email') ?? '').trim(),
			password: String(formData.get('password') ?? '')
		};

		const parsed = SignInSchema.safeParse(raw);
		if (!parsed.success) {
			// Don't leak which field is malformed — same generic message as a bad
			// credential pair (FR-AUTH-1: no enumeration).
			return fail(400, { email: raw.email, message: 'Email or password is incorrect.' });
		}

		try {
			await auth.api.signInEmail({
				body: { email: parsed.data.email, password: parsed.data.password },
				headers: request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				// 429 from the rate-limit plugin gets its own message; everything
				// else collapses to the generic credential error.
				if (err.statusCode === 429) {
					return fail(429, {
						email: raw.email,
						message: 'Too many sign-in attempts. Try again in a few minutes.'
					});
				}
				return fail(401, {
					email: raw.email,
					message: 'Email or password is incorrect.'
				});
			}
			throw err;
		}

		// `next` may be set by the (app) auth guard; only honor same-origin paths.
		const next = url.searchParams.get('next');
		const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
		throw redirect(303, safe);
	}
};
