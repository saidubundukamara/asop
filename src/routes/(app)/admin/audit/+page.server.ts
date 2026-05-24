import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { requireUser, requireRole } from '$lib/server/auth/guards';
import { prisma } from '$lib/server/db';
import { AUDIT_ACTIONS, type AuditAction } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

// FR-AUDIT-1: append-only audit log with admin-only viewer.
//
// Admin-role enforcement happens in `(app)/admin/+layout.server.ts`; we only
// have to deal with input parsing + the query shape here. Pagination matches
// the offset style used by /tasks (PAGE_SIZE + page number) so the UX is
// consistent — a future move to cursor pagination would touch every list at once.

const PAGE_SIZE = 50;
const CSV_BATCH_SIZE = 1000;

const filtersSchema = z.object({
	actor: z
		.string()
		.trim()
		.optional()
		.transform((v) => (v ? v : undefined)),
	action: z
		.string()
		.trim()
		.optional()
		.transform((v) =>
			v && (AUDIT_ACTIONS as readonly string[]).includes(v) ? (v as AuditAction) : undefined
		),
	targetType: z
		.string()
		.trim()
		.max(80)
		.optional()
		.transform((v) => (v ? v : undefined)),
	from: z
		.string()
		.trim()
		.optional()
		.transform((v) => {
			if (!v) return undefined;
			const d = new Date(v);
			return isNaN(d.getTime()) ? undefined : d;
		}),
	to: z
		.string()
		.trim()
		.optional()
		.transform((v) => {
			if (!v) return undefined;
			const d = new Date(v);
			return isNaN(d.getTime()) ? undefined : d;
		}),
	page: z
		.string()
		.optional()
		.transform((v) => {
			const n = parseInt(v ?? '1', 10);
			return Number.isFinite(n) && n >= 1 ? n : 1;
		})
});

type ParsedFilters = z.infer<typeof filtersSchema>;

function whereFromFilters(f: ParsedFilters): Prisma.AuditLogWhereInput {
	const where: Prisma.AuditLogWhereInput = {};
	if (f.actor) where.actorId = f.actor;
	if (f.action) where.action = f.action;
	if (f.targetType) where.targetType = f.targetType;
	if (f.from || f.to) {
		where.createdAt = {};
		if (f.from) where.createdAt.gte = f.from;
		if (f.to) where.createdAt.lte = f.to;
	}
	return where;
}

function parseFiltersFromUrl(url: URL): ParsedFilters {
	const raw = Object.fromEntries(url.searchParams.entries());
	return filtersSchema.parse(raw);
}

export const load: PageServerLoad = async (event) => {
	requireRole(requireUser(event), ['admin']);
	const filters = parseFiltersFromUrl(event.url);
	const where = whereFromFilters(filters);

	const [entries, total, actors, targetTypes] = await Promise.all([
		prisma.auditLog.findMany({
			where,
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			skip: (filters.page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
			select: {
				id: true,
				actorId: true,
				action: true,
				targetType: true,
				targetId: true,
				beforeJson: true,
				afterJson: true,
				createdAt: true,
				actor: { select: { id: true, name: true, email: true } }
			}
		}),
		prisma.auditLog.count({ where }),
		// Dropdown source for actor filter — admins are a small set; include any
		// user who has ever written an audit row, so deactivated actors still
		// show up for historical filtering.
		prisma.user.findMany({
			where: { auditLogs: { some: {} } },
			orderBy: { name: 'asc' },
			select: { id: true, name: true, email: true }
		}),
		// Distinct target types seen so far — small cardinality (user, task,
		// report, attachment, auth.signin, ...). Useful for narrowing the filter
		// without having to remember the exact strings.
		prisma.auditLog
			.findMany({
				distinct: ['targetType'],
				select: { targetType: true },
				orderBy: { targetType: 'asc' }
			})
			.then((rows) => rows.map((r) => r.targetType))
	]);

	return {
		entries,
		total,
		page: filters.page,
		pageSize: PAGE_SIZE,
		hasMore: filters.page * PAGE_SIZE < total,
		filters: {
			actor: filters.actor ?? '',
			action: filters.action ?? '',
			targetType: filters.targetType ?? '',
			from: event.url.searchParams.get('from') ?? '',
			to: event.url.searchParams.get('to') ?? ''
		},
		actors,
		targetTypes,
		actions: AUDIT_ACTIONS
	};
};

function csvEscape(value: unknown): string {
	if (value === null || value === undefined) return '';
	const s = typeof value === 'string' ? value : JSON.stringify(value);
	// Per RFC 4180: quote if the value contains ", comma, newline, or carriage
	// return; double any embedded quotes.
	if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
	return s;
}

export const actions: Actions = {
	// CSV export of the currently-filtered audit log. Streams in 1000-row
	// batches so a large log (years of data) doesn't load entirely into memory.
	exportCsv: async (event) => {
		requireRole(requireUser(event), ['admin']);
		const filters = parseFiltersFromUrl(event.url);
		const where = whereFromFilters(filters);
		const today = new Date().toISOString().slice(0, 10);

		const stream = new ReadableStream({
			async start(controller) {
				const enc = new TextEncoder();
				controller.enqueue(
					enc.encode(
						'timestamp,actor_id,actor_email,action,target_type,target_id,before_json,after_json\n'
					)
				);

				let cursor: string | undefined;
				while (true) {
					const batch = await prisma.auditLog.findMany({
						where,
						orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
						take: CSV_BATCH_SIZE,
						...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
						select: {
							id: true,
							createdAt: true,
							actorId: true,
							action: true,
							targetType: true,
							targetId: true,
							beforeJson: true,
							afterJson: true,
							actor: { select: { email: true } }
						}
					});
					if (batch.length === 0) break;

					for (const row of batch) {
						const line = [
							row.createdAt.toISOString(),
							row.actorId ?? '',
							row.actor?.email ?? '',
							row.action,
							row.targetType,
							row.targetId,
							row.beforeJson,
							row.afterJson
						]
							.map(csvEscape)
							.join(',');
						controller.enqueue(enc.encode(line + '\n'));
					}

					if (batch.length < CSV_BATCH_SIZE) break;
					cursor = batch[batch.length - 1].id;
				}
				controller.close();
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="audit-log-${today}.csv"`,
				'Cache-Control': 'no-store'
			}
		});
	}
};
