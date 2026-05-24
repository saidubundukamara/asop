import { requireUser } from '$lib/server/auth/guards';
import { loadDashboard } from '$lib/server/dashboard/summary';
import type { PageServerLoad } from './$types';

// FR-DASH-1/2/3 — role-aware dashboard. All branching lives in loadDashboard
// so this file stays a thin guard + delegate.
export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	const dashboard = await loadDashboard(actor);
	return { dashboard };
};
