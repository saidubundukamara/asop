// Phase 7 — Postgres full-text search (FR-SEARCH-1).
//
// One $queryRaw per surface (cheaper than a single UNION because every surface
// has a different visibility join). RBAC is applied at the SQL layer, never
// post-filtered in JS — the Phase 7 acceptance test asserts staff can never
// see another user's data through the search endpoint.
//
// We rely on Postgres's websearch_to_tsquery: it tolerates any user input
// (mismatched quotes, lone operators, empty strings) without throwing, so the
// only validation the endpoint needs to do is "at least 2 chars".
//
// Each row carries a ts_headline snippet so the UI doesn't need a second
// round-trip to render the match preview.

import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';
import type { RbacUser } from '$lib/server/rbac';

export const SEARCH_DEFAULT_LIMIT = 5;

// Sentinel borrowed from the rest of the codebase (see tasks/+page.server.ts):
// a manager with no department must match nothing, not "any unassigned row".
const NO_DEPT = '___none___';

const HEADLINE_OPTS = 'MaxFragments=1, MaxWords=14, MinWords=4, ShortWord=2';

export type StaffHit = {
	type: 'staff';
	id: string;
	name: string;
	email: string;
	photoUrl: string | null;
	href: string;
};

export type TaskHit = {
	type: 'task';
	id: string;
	title: string;
	snippet: string;
	href: string;
};

export type ReportHit = {
	type: 'report';
	id: string;
	label: string; // templateName by author
	snippet: string;
	href: string;
};

export type TaskCommentHit = {
	type: 'task_comment';
	id: string; // taskId — comments don't have their own detail route
	taskTitle: string;
	snippet: string;
	href: string;
};

export type ReportCommentHit = {
	type: 'report_comment';
	id: string; // reportId
	reportLabel: string;
	snippet: string;
	href: string;
};

export type SearchResults = {
	staff: StaffHit[];
	tasks: TaskHit[];
	reports: ReportHit[];
	taskComments: TaskCommentHit[];
	reportComments: ReportCommentHit[];
};

export async function searchAll(
	actor: RbacUser,
	q: string,
	opts: { limit?: number } = {}
): Promise<SearchResults> {
	const limit = opts.limit ?? SEARCH_DEFAULT_LIMIT;
	const role = actor.role;
	const actorDept = actor.departmentId ?? NO_DEPT;

	// Parallel — every surface is an independent query.
	const [staff, tasks, reports, taskComments, reportComments] = await Promise.all([
		searchStaff(role, actorDept, q, limit),
		searchTasks(role, actor.id, actorDept, q, limit),
		searchReports(role, actor.id, actorDept, q, limit),
		searchTaskComments(role, actor.id, actorDept, q, limit),
		searchReportComments(role, actor.id, actorDept, q, limit)
	]);

	return { staff, tasks, reports, taskComments, reportComments };
}

// --- staff (user) ----------------------------------------------------------

async function searchStaff(
	role: string,
	actorDept: string,
	q: string,
	limit: number
): Promise<StaffHit[]> {
	// Staff role has no directory access at all — matches /api/users/search.
	if (role === 'staff') return [];

	const deptClause =
		role === 'manager' ? Prisma.sql`AND u."departmentId" = ${actorDept}` : Prisma.sql``;

	const rows = await prisma.$queryRaw<
		{ id: string; name: string; email: string; photoUrl: string | null }[]
	>`
		SELECT u."id", u."name", u."email", u."photoUrl"
		FROM "user" u
		WHERE u."isActive" = true
		  AND u."search_tsv" @@ websearch_to_tsquery('simple', ${q})
		  ${deptClause}
		ORDER BY ts_rank_cd(u."search_tsv", websearch_to_tsquery('simple', ${q})) DESC,
		         u."name" ASC
		LIMIT ${limit}
	`;

	return rows.map((r) => ({
		type: 'staff',
		id: r.id,
		name: r.name,
		email: r.email,
		photoUrl: r.photoUrl,
		href: `/staff/${r.id}`
	}));
}

// --- tasks -----------------------------------------------------------------

async function searchTasks(
	role: string,
	actorId: string,
	actorDept: string,
	q: string,
	limit: number
): Promise<TaskHit[]> {
	const scopeClause =
		role === 'admin'
			? Prisma.sql``
			: role === 'manager'
				? Prisma.sql`AND t."departmentId" = ${actorDept}`
				: // staff: own assignments + own creations only
					Prisma.sql`AND (t."assigneeId" = ${actorId} OR t."assignerId" = ${actorId})`;

	const rows = await prisma.$queryRaw<{ id: string; title: string; snippet: string }[]>`
		SELECT
			t."id",
			t."title",
			ts_headline(
				'english',
				coalesce(t."title", '') || ' — ' || coalesce(regexp_replace(t."description", '<[^>]+>', ' ', 'g'), ''),
				websearch_to_tsquery('english', ${q}),
				${HEADLINE_OPTS}
			) AS snippet
		FROM "task" t
		WHERE t."deletedAt" IS NULL
		  AND t."search_tsv" @@ websearch_to_tsquery('english', ${q})
		  ${scopeClause}
		ORDER BY ts_rank_cd(t."search_tsv", websearch_to_tsquery('english', ${q})) DESC,
		         t."updatedAt" DESC
		LIMIT ${limit}
	`;

	return rows.map((r) => ({
		type: 'task',
		id: r.id,
		title: r.title,
		snippet: r.snippet,
		href: `/tasks/${r.id}`
	}));
}

// --- reports (matched via report_field_value text) -------------------------

async function searchReports(
	role: string,
	actorId: string,
	actorDept: string,
	q: string,
	limit: number
): Promise<ReportHit[]> {
	const scopeClause =
		role === 'admin'
			? Prisma.sql``
			: role === 'manager'
				? Prisma.sql`AND rt."departmentId" = ${actorDept}`
				: Prisma.sql`AND r."authorId" = ${actorId}`;

	// DISTINCT ON: a single report can have many matching field values; we want
	// one row per report with its best-ranked snippet.
	const rows = await prisma.$queryRaw<
		{ id: string; templateName: string; authorName: string | null; snippet: string }[]
	>`
		SELECT DISTINCT ON (r."id")
			r."id",
			rt."name" AS "templateName",
			u."name" AS "authorName",
			ts_headline('english', rfv."valueText", websearch_to_tsquery('english', ${q}), ${HEADLINE_OPTS}) AS snippet
		FROM "report_field_value" rfv
		JOIN "report" r ON r."id" = rfv."reportId"
		JOIN "report_template" rt ON rt."id" = r."templateId"
		LEFT JOIN "user" u ON u."id" = r."authorId"
		WHERE rfv."valueText" IS NOT NULL
		  AND rfv."search_tsv" @@ websearch_to_tsquery('english', ${q})
		  ${scopeClause}
		ORDER BY r."id",
		         ts_rank_cd(rfv."search_tsv", websearch_to_tsquery('english', ${q})) DESC
		LIMIT ${limit}
	`;

	return rows.map((r) => ({
		type: 'report',
		id: r.id,
		label: r.authorName ? `${r.templateName} — ${r.authorName}` : r.templateName,
		snippet: r.snippet,
		href: `/reports/${r.id}`
	}));
}

// --- task comments (inherit task visibility) -------------------------------

async function searchTaskComments(
	role: string,
	actorId: string,
	actorDept: string,
	q: string,
	limit: number
): Promise<TaskCommentHit[]> {
	const scopeClause =
		role === 'admin'
			? Prisma.sql``
			: role === 'manager'
				? Prisma.sql`AND t."departmentId" = ${actorDept}`
				: Prisma.sql`AND (t."assigneeId" = ${actorId} OR t."assignerId" = ${actorId})`;

	const rows = await prisma.$queryRaw<{ taskId: string; taskTitle: string; snippet: string }[]>`
		SELECT
			tc."taskId" AS "taskId",
			t."title" AS "taskTitle",
			ts_headline('english', tc."body", websearch_to_tsquery('english', ${q}), ${HEADLINE_OPTS}) AS snippet
		FROM "task_comment" tc
		JOIN "task" t ON t."id" = tc."taskId"
		WHERE tc."deletedAt" IS NULL
		  AND t."deletedAt" IS NULL
		  AND tc."search_tsv" @@ websearch_to_tsquery('english', ${q})
		  ${scopeClause}
		ORDER BY ts_rank_cd(tc."search_tsv", websearch_to_tsquery('english', ${q})) DESC,
		         tc."createdAt" DESC
		LIMIT ${limit}
	`;

	return rows.map((r) => ({
		type: 'task_comment',
		id: r.taskId,
		taskTitle: r.taskTitle,
		snippet: r.snippet,
		href: `/tasks/${r.taskId}`
	}));
}

// --- report comments (inherit report visibility) ---------------------------

async function searchReportComments(
	role: string,
	actorId: string,
	actorDept: string,
	q: string,
	limit: number
): Promise<ReportCommentHit[]> {
	const scopeClause =
		role === 'admin'
			? Prisma.sql``
			: role === 'manager'
				? Prisma.sql`AND rt."departmentId" = ${actorDept}`
				: Prisma.sql`AND r."authorId" = ${actorId}`;

	const rows = await prisma.$queryRaw<
		{ reportId: string; templateName: string; authorName: string | null; snippet: string }[]
	>`
		SELECT
			rc."reportId" AS "reportId",
			rt."name" AS "templateName",
			u."name" AS "authorName",
			ts_headline('english', rc."body", websearch_to_tsquery('english', ${q}), ${HEADLINE_OPTS}) AS snippet
		FROM "report_comment" rc
		JOIN "report" r ON r."id" = rc."reportId"
		JOIN "report_template" rt ON rt."id" = r."templateId"
		LEFT JOIN "user" u ON u."id" = r."authorId"
		WHERE rc."deletedAt" IS NULL
		  AND rc."search_tsv" @@ websearch_to_tsquery('english', ${q})
		  ${scopeClause}
		ORDER BY ts_rank_cd(rc."search_tsv", websearch_to_tsquery('english', ${q})) DESC,
		         rc."createdAt" DESC
		LIMIT ${limit}
	`;

	return rows.map((r) => ({
		type: 'report_comment',
		id: r.reportId,
		reportLabel: r.authorName ? `${r.templateName} — ${r.authorName}` : r.templateName,
		snippet: r.snippet,
		href: `/reports/${r.reportId}`
	}));
}
