import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	throw redirect(307, locals.user ? '/dashboard' : '/sign-in');
};

export const actions: Actions = {
	// Reachable as `<form method="POST" action="/?/signOut">` from any page —
	// see TopBar.svelte's avatar menu.
	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		throw redirect(303, '/sign-in');
	}
};
