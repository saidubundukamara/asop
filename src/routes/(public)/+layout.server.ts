import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Signed-in users don't need /sign-in or /forgot-password — bounce them
// straight to the app. Accept-invite and reset-password still need to work
// while signed in (so users can re-bind / change credentials), so those
// routes opt out by living outside (public) — actually they're inside
// (public) but they handle the authed case in their own loaders below.
export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user) return {};
	const protectedPaths = ['/sign-in', '/forgot-password'];
	if (protectedPaths.some((p) => url.pathname.startsWith(p))) {
		throw redirect(307, '/dashboard');
	}
	return {};
};
