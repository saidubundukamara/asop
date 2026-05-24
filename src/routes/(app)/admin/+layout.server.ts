import { requireUser, requireRole } from '$lib/server/auth/guards';
import type { LayoutServerLoad } from './$types';

// Admin subtree guard. Anything under (app)/admin/ requires role === 'admin'.
// Phase 9 builds out /admin/audit; Phase 7 adds the gate now so dashboard
// links don't 404 and so future admin routes inherit the guard for free.
export const load: LayoutServerLoad = async (event) => {
	const actor = requireUser(event);
	requireRole(actor, ['admin']);
	return {};
};
