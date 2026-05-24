import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

// FR-REP-5 — Report template admin (list + create + archive).
// /templates/+layout.server.ts already requires role === 'admin'; each action
// re-asserts via requireCan() for defence-in-depth.

export const load: PageServerLoad = async (event) => {
	requireUser(event);
	const showInactive = event.url.searchParams.get('showInactive') === '1';

	const [templates, departments] = await Promise.all([
		prisma.reportTemplate.findMany({
			where: showInactive ? {} : { isActive: true },
			orderBy: [{ name: 'asc' }, { version: 'desc' }],
			select: {
				id: true,
				name: true,
				description: true,
				reviewerRole: true,
				version: true,
				isActive: true,
				createdAt: true,
				department: { select: { id: true, name: true } },
				_count: { select: { fields: true, reports: true } }
			}
		}),
		prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
	]);

	return { templates, departments, showInactive };
};

// Each field in the create form is a JSON-stringified array item.
// We receive them as a flat list: field[0][label], field[0][fieldType], etc.
// For simplicity in v1, fields are sent as a JSON string in a single textarea.
const fieldSchema = z.object({
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

const createSchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(120),
	description: z.string().optional().default(''),
	departmentId: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	reviewerRole: z.enum(['manager', 'admin'], { message: 'Pick a reviewer role' }),
	// JSON array of field objects — the field editor serializes to this.
	fieldsJson: z.string().min(2, 'At least one field is required')
});

const archiveSchema = z.object({ id: z.string().min(1) });

export const actions: Actions = {
	create: withAction(createSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'report_template.create', { type: 'report_template' });

		let parsedFields: z.infer<typeof fieldSchema>[];
		try {
			const raw = JSON.parse(input.fieldsJson);
			if (!Array.isArray(raw) || raw.length === 0) throw new Error();
			parsedFields = raw.map((f: unknown) => fieldSchema.parse(f));
		} catch {
			return { ok: false as const, issues: { fieldsJson: ['Invalid field definitions'] } };
		}

		const created = await prisma.$transaction(async (tx) => {
			const tpl = await tx.reportTemplate.create({
				data: {
					name: input.name,
					description: input.description || null,
					departmentId: input.departmentId,
					reviewerRole: input.reviewerRole,
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
				select: { id: true, name: true, version: true }
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'report_template.created',
				target: { type: 'report_template', id: tpl.id },
				after: { name: tpl.name, version: tpl.version }
			});
			return tpl;
		});

		return { ok: true, data: { id: created.id } };
	}),

	archive: withAction(archiveSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'report_template.archive', { type: 'report_template' });

		const tpl = await prisma.reportTemplate.findUnique({
			where: { id: input.id },
			select: { id: true, isActive: true }
		});
		if (!tpl) throw error(404, 'Template not found');

		await prisma.$transaction(async (tx) => {
			await tx.reportTemplate.update({ where: { id: input.id }, data: { isActive: false } });
			await audit(tx, {
				actorId: actor.id,
				action: 'report_template.archived',
				target: { type: 'report_template', id: input.id },
				before: { isActive: tpl.isActive },
				after: { isActive: false }
			});
		});

		return { ok: true, data: { id: input.id } };
	})
};
