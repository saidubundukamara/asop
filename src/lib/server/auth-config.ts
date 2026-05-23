import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { haveIBeenPwned } from 'better-auth/plugins/haveibeenpwned';
import type { BetterAuthOptions } from 'better-auth';
import { prisma } from './db';
import { checkPasswordPolicy, passwordPolicyMessage } from './auth/password-policy';
import { sendInviteEmail, sendPasswordResetEmail } from './email';

// Shared Better Auth options. SvelteKit-coupled plugins (sveltekitCookies)
// live in auth.ts so they don't poison this module — @better-auth/cli loads
// this file via jiti to generate the schema, and jiti can't resolve
// $app/server. The CLI builds a betterAuth() instance from these options in
// auth-cli.ts and emits the schema; the runtime app uses auth.ts.

const APP_URL = process.env.PUBLIC_APP_URL ?? 'http://localhost:5173';

if (!process.env.BETTER_AUTH_SECRET) {
	throw new Error('BETTER_AUTH_SECRET is not set');
}

export const baseAuthConfig = {
	database: prismaAdapter(prisma, { provider: 'postgresql' }),
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: APP_URL,
	trustedOrigins: [APP_URL],

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 10,
		maxPasswordLength: 128,
		autoSignIn: true,
		requireEmailVerification: false,
		sendResetPassword: async ({ user, url }) => {
			await sendPasswordResetEmail(user.email, url);
		}
	},

	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			// Same template as the manual admin-invite flow — both land the
			// invitee on /accept-invite/[token] to set their first password.
			await sendInviteEmail(user.email, url);
		}
	},

	user: {
		additionalFields: {
			// Privilege-bearing fields — `input: false` blocks the public sign-up
			// endpoint from accepting these in the request body. Set them only via
			// server-side admin actions (see scripts/seed-invite.ts in chunk 11).
			role: {
				type: 'string',
				required: true,
				defaultValue: 'staff',
				input: false
			},
			departmentId: {
				type: 'string',
				required: false,
				input: false
			},
			isActive: {
				type: 'boolean',
				required: true,
				defaultValue: true,
				input: false
			},
			lastSignInAt: {
				type: 'date',
				required: false,
				input: false
			},
			// User-editable profile fields (FR-AUTH-5; editing UI lands in Phase 2).
			phone: { type: 'string', required: false },
			photoUrl: { type: 'string', required: false },
			timeZone: { type: 'string', required: false, defaultValue: 'UTC' }
		}
	},

	// FR-AUTH-1: rate-limit sign-in to 5 attempts / 10 minutes per IP.
	// `storage: 'database'` is critical on Vercel — the in-memory default is
	// per-invocation on serverless functions and effectively bypassable.
	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
		storage: 'database',
		// FR-AUTH-1: "after 5 failed attempts within 10 minutes". Better Auth's
		// counter has fence-post quirks empirically — max:5 → 4 attempts allowed,
		// max:6 → 6. We pick max:5 (stricter side) to err toward security; one
		// fewer brute-force guess beats one more.
		customRules: {
			'/sign-in/email': { window: 600, max: 5 },
			'/forget-password': { window: 600, max: 5 },
			'/reset-password': { window: 600, max: 10 }
		}
	},

	hooks: {
		// The "at least one number" rule lives here. Min-length is handled by
		// Better Auth's native `minPasswordLength` above; common-password check
		// is handled by the haveIBeenPwned plugin below.
		before: createAuthMiddleware(async (ctx) => {
			const policed = new Set(['/sign-up/email', '/reset-password', '/change-password']);
			if (!policed.has(ctx.path)) return;

			const body = ctx.body as { password?: string; newPassword?: string } | undefined;
			const candidate = body?.password ?? body?.newPassword;
			if (typeof candidate !== 'string') return;

			// checkPasswordPolicy returns issues in [too-short, no-digit] order;
			// surface them in that order so the user sees the more obvious
			// failure first.
			const [firstIssue] = checkPasswordPolicy(candidate);
			if (firstIssue) {
				throw new APIError('BAD_REQUEST', {
					message: passwordPolicyMessage(firstIssue)
				});
			}
		})
	},

	plugins: [
		haveIBeenPwned({
			customPasswordCompromisedMessage:
				'This password has appeared in a known data breach. Pick a different one.'
		})
	]
} satisfies BetterAuthOptions;
