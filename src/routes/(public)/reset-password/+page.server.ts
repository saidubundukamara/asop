import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import {
	checkPasswordPolicy,
	passwordPolicyMessage
} from '$lib/server/auth/password-policy';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		throw redirect(307, '/forgot-password');
	}
	return { token };
};

const ResetSchema = z.object({
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

		// Client-side policy preview so the user gets immediate feedback on
		// length/digit failures without a server round-trip per char. The
		// server-side hooks.before in auth-config.ts re-checks before the
		// reset is accepted, so this is just UX.
		const policyIssues = checkPasswordPolicy(raw.password);
		if (policyIssues.length > 0) {
			return fail(400, { message: passwordPolicyMessage(policyIssues[0]) });
		}

		const parsed = ResetSchema.safeParse(raw);
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
					return fail(429, {
						message: 'Too many attempts. Try again in a few minutes.'
					});
				}
				// HIBP plugin + password-policy hook surface APIError with their
				// own messages — propagate so the user sees "this password is
				// compromised" / "must include a number".
				return fail(400, {
					message: err.body?.message ?? 'Could not reset password. The link may have expired.'
				});
			}
			throw err;
		}

		// Better Auth invalidates existing sessions on reset by default — bounce
		// the user to /sign-in to authenticate fresh.
		throw redirect(303, '/sign-in?reason=reset');
	}
};
