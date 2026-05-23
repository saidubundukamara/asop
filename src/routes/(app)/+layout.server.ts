import { requireUser } from '$lib/server/auth/guards';
import type { LayoutServerLoad } from './$types';

// Auth wall for every authenticated route. requireUser redirects to /sign-in
// (with ?next set) when locals.user is missing or the account is deactivated.
export const load: LayoutServerLoad = (event) => {
	const user = requireUser(event);
	return { user };
};
