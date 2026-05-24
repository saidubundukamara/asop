import { redirect, error } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { directoryScope } from '$lib/server/rbac';
import { notify } from '$lib/server/notify';
import { NOTIFICATION_TYPES } from '$lib/server/notifications/types';
import type { Actions, PageServerLoad } from './$types';

// FR-REP-1 / FR-REP-3 — create a new report draft + auto-save + submit.

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	requireCan(actor, 'report.create', { type: 'report_list' });

	const scope = directoryScope(actor);
	const taskId = event.url.searchParams.get('taskId') || null;

	// Active templates filtered by the actor's department scope.
	const templates = await prisma.reportTemplate.findMany({
		where: {
			isActive: true,
			...(scope === 'self' || scope === 'team'
				? {
						OR: [
							{ departmentId: actor.departmentId ?? undefined },
							{ departmentId: null } // templates with no dept restriction are available to all
						]
					}
				: {})
		},
		orderBy: { name: 'asc' },
		select: {
			id: true,
			name: true,
			description: true,
			version: true,
			reviewerRole: true,
			department: { select: { id: true, name: true } },
			fields: {
				orderBy: { displayOrder: 'asc' },
				select: {
					id: true,
					label: true,
					fieldType: true,
					helpText: true,
					isRequired: true,
					displayOrder: true,
					configJson: true,
					defaultValue: true
				}
			}
		}
	});

	// Pre-selected template from query param.
	const templateId = event.url.searchParams.get('templateId');
	const preselected = templateId ? (templates.find((t) => t.id === templateId) ?? null) : null;

	return { templates, preselected, taskId, actor: { id: actor.id, role: actor.role } };
};

// Field values sent as a JSON string: [{ fieldId, value }]
const fieldValueSchema = z.object({
	fieldId: z.string().min(1),
	valueText: z.string().optional(),
	valueNumber: z
		.string()
		.optional()
		.transform((v) => (v !== undefined && v !== '' ? Number(v) : null)),
	valueDate: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? new Date(v) : null)),
	valueJson: z
		.string()
		.optional()
		.transform((v) => {
			if (!v) return null;
			try {
				return JSON.parse(v);
			} catch {
				return null;
			}
		})
});

const createSchema = z.object({
	templateId: z.string().min(1, 'Please select a template'),
	taskId: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	valuesJson: z.string().optional().default('[]')
});

const autosaveSchema = z.object({
	reportId: z.string().min(1),
	valuesJson: z.string().optional().default('[]')
});

const submitSchema = z.object({
	reportId: z.string().min(1),
	valuesJson: z.string().optional().default('[]')
});

async function upsertFieldValues(
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	reportId: string,
	rawJson: string
) {
	let values: z.infer<typeof fieldValueSchema>[];
	try {
		const raw = JSON.parse(rawJson);
		values = Array.isArray(raw) ? raw.map((v: unknown) => fieldValueSchema.parse(v)) : [];
	} catch {
		values = [];
	}

	for (const v of values) {
		await tx.reportFieldValue.upsert({
			where: { reportId_fieldId: { reportId, fieldId: v.fieldId } },
			update: {
				valueText: v.valueText ?? null,
				valueNumber: v.valueNumber ?? null,
				valueDate: v.valueDate ?? null,
				valueJson: v.valueJson ?? undefined
			},
			create: {
				reportId,
				fieldId: v.fieldId,
				valueText: v.valueText ?? null,
				valueNumber: v.valueNumber ?? null,
				valueDate: v.valueDate ?? null,
				valueJson: v.valueJson ?? undefined
			}
		});
	}
}

export const actions: Actions = {
	// Create a new draft.
	create: withAction(createSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'report.create', { type: 'report_list' });

		const tpl = await prisma.reportTemplate.findUnique({
			where: { id: input.templateId, isActive: true },
			select: { id: true, version: true }
		});
		if (!tpl) throw error(404, 'Template not found or inactive');

		const report = await prisma.$transaction(async (tx) => {
			const r = await tx.report.create({
				data: {
					templateId: tpl.id,
					templateVersion: tpl.version,
					authorId: actor.id,
					taskId: input.taskId
				},
				select: { id: true }
			});
			await upsertFieldValues(tx, r.id, input.valuesJson);
			return r;
		});

		return { ok: true, data: { reportId: report.id } };
	}),

	// Auto-save: upsert field values on an existing draft. No audit.
	autosave: withAction(autosaveSchema, async (input, event) => {
		const actor = requireUser(event);

		const report = await prisma.report.findUnique({
			where: { id: input.reportId },
			select: { id: true, authorId: true, status: true }
		});
		if (!report || report.authorId !== actor.id || report.status !== 'draft') {
			throw error(403, 'Cannot autosave this report');
		}

		await prisma.$transaction(async (tx) => {
			await upsertFieldValues(tx, report.id, input.valuesJson);
			await tx.report.update({
				where: { id: report.id },
				data: { updatedAt: new Date() }
			});
		});

		return { ok: true, data: { reportId: report.id } };
	}),

	// Submit: validate required fields, transition draft → submitted.
	submit: withAction(submitSchema, async (input, event) => {
		const actor = requireUser(event);

		const report = await prisma.report.findUnique({
			where: { id: input.reportId },
			select: {
				id: true,
				authorId: true,
				status: true,
				template: {
					select: {
						id: true,
						name: true,
						departmentId: true,
						reviewerRole: true,
						fields: { where: { isRequired: true }, select: { id: true, label: true } }
					}
				}
			}
		});
		if (!report) throw error(404, 'Report not found');
		if (report.authorId !== actor.id && actor.role !== 'admin') {
			throw error(403, 'Not allowed');
		}
		if (report.status !== 'draft' && report.status !== 'needs_revision') {
			throw error(400, 'Report cannot be submitted from its current status');
		}

		// Persist the final field values before validating.
		await prisma.$transaction(async (tx) => {
			await upsertFieldValues(tx, report.id, input.valuesJson);
		});

		// Server-side required field validation.
		const requiredFieldIds = report.template.fields.map((f) => f.id);
		if (requiredFieldIds.length > 0) {
			const filled = await prisma.reportFieldValue.findMany({
				where: {
					reportId: report.id,
					fieldId: { in: requiredFieldIds },
					OR: [
						{ valueText: { not: null } },
						{ valueNumber: { not: null } },
						{ valueDate: { not: null } },
						{ valueJson: { not: undefined } }
					]
				},
				select: { fieldId: true }
			});
			const filledIds = new Set(filled.map((f) => f.fieldId));
			const missing = report.template.fields.filter((f) => !filledIds.has(f.id));
			if (missing.length > 0) {
				const issues: Record<string, string[]> = {};
				for (const f of missing) {
					issues[`field_${f.id}`] = [`${f.label} is required`];
				}
				return { ok: false as const, issues };
			}
		}

		await prisma.report.update({
			where: { id: report.id },
			data: { status: 'submitted', submittedAt: new Date() }
		});

		// Notify reviewers — fire-and-forget.
		const reviewerWhere =
			report.template.reviewerRole === 'admin'
				? { role: 'admin', isActive: true }
				: {
						role: 'manager',
						isActive: true,
						departmentId: report.template.departmentId ?? undefined
					};
		const reviewers = await prisma.user.findMany({
			where: reviewerWhere,
			select: { id: true }
		});
		for (const reviewer of reviewers) {
			if (reviewer.id !== actor.id) {
				notify({
					recipientId: reviewer.id,
					type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
					title: 'Report submitted for review',
					body: `${report.template.name} — submitted by ${actor.name ?? actor.email}`,
					deepLink: `/reports/${report.id}`
				}).catch(() => {});
			}
		}

		redirect(303, `/reports/${report.id}`);
	})
};
