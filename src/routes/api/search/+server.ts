import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { searchAll, SEARCH_DEFAULT_LIMIT } from '$lib/server/db/search';
import type { RequestHandler } from './$types';

// GET /api/search?q=…
//
// Drives the Cmd/K palette. RBAC scope is applied inside searchAll() at the
// SQL layer — never trust the client to filter. Returns five named groups
// matching the SearchResults type; each group is capped at SEARCH_DEFAULT_LIMIT.

const MIN_QUERY_LEN = 2;

export const GET: RequestHandler = async (event) => {
	const actor = requireUser(event);

	const q = (event.url.searchParams.get('q') ?? '').trim();
	if (q.length < MIN_QUERY_LEN) {
		return json({
			staff: [],
			tasks: [],
			reports: [],
			taskComments: [],
			reportComments: []
		});
	}

	const results = await searchAll(actor, q, { limit: SEARCH_DEFAULT_LIMIT });
	return json(results);
};
