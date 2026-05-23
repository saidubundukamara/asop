// Manual invite flow for Phase 1 — there's no admin UI yet (lands Phase 2).
//
// Usage: npx tsx scripts/seed-invite.ts <email> [role=staff] [name...]
//
// Creates the user (with a throwaway random password the invitee never sees)
// and triggers Better Auth's requestPasswordReset against that account. The
// dev email transport (chunk 8) logs the resulting URL to terminal; the
// invitee opens it and lands on /accept-invite to set their first password.

import crypto from 'node:crypto';
import { config } from 'dotenv';
config();

// auth-cli.ts is the SvelteKit-free Better Auth instance — safe to import
// from a Node script. auth.ts pulls in $app/server and would crash here.
import { auth } from '../src/lib/server/auth-cli';
import { prisma } from '../src/lib/server/db';

type Role = 'admin' | 'manager' | 'staff';

const [, , email, roleArg = 'staff', ...nameParts] = process.argv;

if (!email) {
	console.error('Usage: npx tsx scripts/seed-invite.ts <email> [role=staff] [name...]');
	process.exit(1);
}

const role = roleArg as Role;
if (!['admin', 'manager', 'staff'].includes(role)) {
	console.error(`Invalid role "${roleArg}". Must be admin | manager | staff.`);
	process.exit(1);
}

const name = nameParts.join(' ') || email.split('@')[0];

// 32 random bytes + a digit so the password-policy hook (>=1 number) is happy.
const throwawayPassword = crypto.randomBytes(32).toString('base64url') + '0';

try {
	const existing = await prisma.user.findUnique({ where: { email } });

	if (existing) {
		console.log(`User ${email} already exists — re-issuing the accept-invite link only.`);
	} else {
		await auth.api.signUpEmail({
			body: { email, password: throwawayPassword, name }
		});
		// `input: false` blocks role/isActive from the public sign-up endpoint;
		// set them server-side now that the row exists.
		await prisma.user.update({
			where: { email },
			data: { role, isActive: true }
		});
		console.log(`Created user: ${email} (role=${role}, name="${name}")`);
	}

	await auth.api.requestPasswordReset({
		body: { email, redirectTo: '/accept-invite' }
	});

	console.log('Invite link printed above by the [email:dev] log. Copy it into your browser.');
} catch (err) {
	console.error('seed-invite failed:', err);
	process.exit(1);
} finally {
	await prisma.$disconnect();
}
