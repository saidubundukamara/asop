import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import {
	checkPasswordPolicy,
	passwordPolicyMessage
} from '$lib/server/auth/password-policy';
import type { Actions, PageServerLoad } from './$types';

// The invite flow piggybacks on Better Auth's password-reset token: the seed
// script (or, in Phase 2, the admin invite UI) creates a user with a
// throwaway password and triggers requestPasswordReset with redirectTo:
// /accept-invite. Same token type, same auth.api.resetPassword call — this
// page just wears welcoming copy and lands the user on /dashboard instead of
// /sign-in on success.

export const load: PageServerLoad = ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token) throw redirect(307, '/sign-in');
	return { token };
};

const AcceptSchema = z.object({
	token: z.string().min(10),
	password: z.string().min(10).max(128)
});

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const raw = {
			token: String(formData.get('token') ?? ''),
			password: String(formData.get('password') ?? '')
		};

		const policyIssues = checkPasswordPolicy(raw.password);
		if (policyIssues.length > 0) {
			return fail(400, { message: passwordPolicyMessage(policyIssues[0]) });
		}

		const parsed = AcceptSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, { message: 'Password does not meet the policy.' });
		}

		try {
			await auth.api.resetPassword({
				body: { token: parsed.data.token, newPassword: parsed.data.password },
				headers: request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				if (err.statusCode === 429) {
					return fail(429, { message: 'Too many attempts. Try again in a few minutes.' });
				}
				return fail(400, {
					message:
						err.body?.message ??
						'Could not accept invitation. The link may have expired or already been used.'
				});
			}
			throw err;
		}

		// Better Auth's autoSignIn (set in auth-config.ts) means the user has a
		// session here without a second round-trip. Land them in the app.
		throw redirect(303, '/dashboard');
	}
};
