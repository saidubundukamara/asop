import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	throw redirect(307, locals.user ? '/dashboard' : '/sign-in');
};
