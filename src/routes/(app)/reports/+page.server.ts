import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import { directoryScope } from '$lib/server/rbac';
import type { PageServerLoad } from './$types';

// FR-REP-6 / FR-REP-7 — role-aware reports list.
// Staff: own reports only (all statuses except draft hidden in "Submitted" tab).
// Manager: team reports, default status = submitted.
// Admin: all reports, default status = submitted.

const PAGE_SIZE = 25;

const validStatuses = ['draft', 'submitted', 'under_review', 'approved', 'needs_revision'] as const;

function parseStatus(raw: string | null) {
	return validStatuses.includes(raw as (typeof validStatuses)[number])
		? (raw as (typeof validStatuses)[number])
		: null;
}

const pageSchema = z
	.string()
	.nullish()
	.transform((v) => Math.max(1, Number(v) || 1));

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	const sp = event.url.searchParams;

	const scope = directoryScope(actor);
	const defaultStatus = scope === 'self' ? null : 'submitted';
	const status = parseStatus(sp.get('status')) ?? defaultStatus;
	const templateId = sp.get('templateId') || null;
	const authorId = sp.get('authorId') || null;
	const page = pageSchema.parse(sp.get('page'));
	const skip = (page - 1) * PAGE_SIZE;

	// Build the where clause based on role scope.
	const scopeFilter =
		scope === 'self'
			? { authorId: actor.id }
			: scope === 'team'
				? { template: { departmentId: actor.departmentId ?? undefined } }
				: {};

	const statusFilter = status ? { status } : {};
	const templateFilter = templateId ? { templateId } : {};
	const authorFilter = authorId && scope !== 'self' ? { authorId } : {};

	const where = { ...scopeFilter, ...statusFilter, ...templateFilter, ...authorFilter };

	const [reports, total, templates] = await Promise.all([
		prisma.report.findMany({
			where,
			orderBy: { updatedAt: 'desc' },
			skip,
			take: PAGE_SIZE,
			select: {
				id: true,
				status: true,
				templateVersion: true,
				submittedAt: true,
				updatedAt: true,
				template: { select: { id: true, name: true } },
				author: { select: { id: true, name: true, photoUrl: true } },
				reviewer: { select: { id: true, name: true } }
			}
		}),
		prisma.report.count({ where }),
		// Templates for the filter dropdown.
		prisma.reportTemplate.findMany({
			where: { isActive: true },
			orderBy: { name: 'asc' },
			select: { id: true, name: true }
		})
	]);

	return {
		reports,
		total,
		page,
		pageSize: PAGE_SIZE,
		totalPages: Math.ceil(total / PAGE_SIZE),
		filters: { status, templateId, authorId },
		scope,
		templates,
		actor: { id: actor.id, role: actor.role }
	};
};
