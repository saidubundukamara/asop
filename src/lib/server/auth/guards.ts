import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

type Role = 'admin' | 'manager' | 'staff';

export type AuthenticatedLocals = App.Locals & {
	user: NonNullable<App.Locals['user']>;
	session: NonNullable<App.Locals['session']>;
};

// Guard for load functions on protected routes. Redirects unauthenticated
// users to /sign-in with ?next set to the path they tried to reach so the
// sign-in form can bounce them back after auth.
export function requireUser(event: RequestEvent): AuthenticatedLocals['user'] {
	const { locals, url } = event;
	if (!locals.user) {
		throw redirect(302, `/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	if (!locals.user.isActive) {
		// Deactivated accounts cannot reach the app (FR-USER-4). Bouncing them to
		// /sign-in is fine — the next sign-in attempt will be rejected too.
		throw redirect(302, '/sign-in?reason=deactivated');
	}
	return locals.user;
}

// Guard for actions / admin routes. Throws 403 if the user is missing one of
// the allowed roles. Caller is expected to have already established that a
// user exists (use requireUser first, or wrap inside withAction).
export function requireRole(
	user: AuthenticatedLocals['user'] | null,
	roles: Role[]
): AuthenticatedLocals['user'] {
	if (!user) throw error(401, 'Not signed in');
	if (!roles.includes(user.role as Role)) throw error(403, 'Forbidden');
	return user;
}
