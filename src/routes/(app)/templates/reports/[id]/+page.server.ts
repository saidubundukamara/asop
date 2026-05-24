import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireUser(event);

	const tpl = await prisma.reportTemplate.findUnique({
		where: { id: event.params.id },
		select: {
			id: true,
			name: true,
			description: true,
			reviewerRole: true,
			version: true,
			isActive: true,
			createdAt: true,
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
			},
			_count: {
				select: {
					// Count non-draft reports to determine version-bump logic.
					reports: true
				}
			}
		}
	});
	if (!tpl) throw error(404, 'Template not found');

	// Count non-draft submissions to decide whether edits require a new version.
	const nonDraftCount = await prisma.report.count({
		where: { templateId: tpl.id, status: { not: 'draft' } }
	});

	const departments = await prisma.department.findMany({
		orderBy: { name: 'asc' },
		select: { id: true, name: true }
	});

	return { tpl, departments, nonDraftCount };
};

const fieldSchema = z.object({
	id: z.string().optional(), // existing field id (omit for new fields)
	label: z.string().trim().min(1).max(200),
	fieldType: z.enum([
		'short_text',
		'long_text',
		'number',
		'date',
		'datetime',
		'dropdown',
		'multi_select',
		'checkbox',
		'file',
		'geolocation'
	]),
	helpText: z.string().optional().default(''),
	isRequired: z
		.string()
		.optional()
		.transform((v) => v === 'true' || v === '1'),
	displayOrder: z
		.string()
		.optional()
		.transform((v) => (v ? Number(v) : 0)),
	configJson: z
		.string()
		.optional()
		.transform((v) => {
			if (!v) return null;
			try {
				return JSON.parse(v);
			} catch {
				return null;
			}
		}),
	defaultValue: z.string().optional().default('')
});

const updateSchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(120),
	description: z.string().optional().default(''),
	departmentId: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	reviewerRole: z.enum(['manager', 'admin']),
	fieldsJson: z.string().min(2)
});

export const actions: Actions = {
	update: withAction(updateSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'report_template.update', { type: 'report_template' });

		const existing = await prisma.reportTemplate.findUnique({
			where: { id: input.id },
			select: { id: true, name: true, version: true, isActive: true }
		});
		if (!existing) throw error(404, 'Template not found');

		let parsedFields: z.infer<typeof fieldSchema>[];
		try {
			const raw = JSON.parse(input.fieldsJson);
			if (!Array.isArray(raw) || raw.length === 0) throw new Error();
			parsedFields = raw.map((f: unknown) => fieldSchema.parse(f));
		} catch {
			return { ok: false as const, issues: { fieldsJson: ['Invalid field definitions'] } };
		}

		const nonDraftCount = await prisma.report.count({
			where: { templateId: input.id, status: { not: 'draft' } }
		});

		const data = {
			name: input.name,
			description: input.description || null,
			departmentId: input.departmentId,
			reviewerRole: input.reviewerRole
		};

		if (nonDraftCount > 0) {
			// Create a new version row; deactivate the old one.
			await prisma.$transaction(async (tx) => {
				const newTpl = await tx.reportTemplate.create({
					data: {
						...data,
						version: existing.version + 1,
						createdById: actor.id,
						fields: {
							create: parsedFields.map((f, i) => ({
								label: f.label,
								fieldType: f.fieldType,
								helpText: f.helpText || null,
								isRequired: f.isRequired,
								displayOrder: f.displayOrder ?? i,
								configJson: f.configJson ?? undefined,
								defaultValue: f.defaultValue || null
							}))
						}
					},
					select: { id: true, version: true }
				});
				await tx.reportTemplate.update({
					where: { id: input.id },
					data: { isActive: false }
				});
				await audit(tx, {
					actorId: actor.id,
					action: 'report_template.updated',
					target: { type: 'report_template', id: newTpl.id },
					after: { version: newTpl.version, reason: 'new_version_due_to_submissions' }
				});
			});
		} else {
			// No non-draft reports — safe to edit in place.
			await prisma.$transaction(async (tx) => {
				// Replace all fields: delete existing, create new.
				await tx.reportField.deleteMany({ where: { templateId: input.id } });
				await tx.reportTemplate.update({
					where: { id: input.id },
					data: {
						...data,
						fields: {
							create: parsedFields.map((f, i) => ({
								label: f.label,
								fieldType: f.fieldType,
								helpText: f.helpText || null,
								isRequired: f.isRequired,
								displayOrder: f.displayOrder ?? i,
								configJson: f.configJson ?? undefined,
								defaultValue: f.defaultValue || null
							}))
						}
					}
				});
				await audit(tx, {
					actorId: actor.id,
					action: 'report_template.updated',
					target: { type: 'report_template', id: input.id },
					after: { name: input.name }
				});
			});
		}

		return { ok: true, data: { id: input.id } };
	})
};
