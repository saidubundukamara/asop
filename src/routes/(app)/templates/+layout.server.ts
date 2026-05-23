import { requireUser, requireRole } from '$lib/server/auth/guards';
import type { LayoutServerLoad } from './$types';

// All /templates routes are admin-only (FR-TASK-8 + PRD § 12 template rows).
// Mirrors the (app)/admin/+layout.server.ts pattern from Phase 2 — assert the
// role here so child routes don't repeat the check.

export const load: LayoutServerLoad = (event) => {
	const actor = requireUser(event);
	requireRole(actor, ['admin']);
	return {};
};
