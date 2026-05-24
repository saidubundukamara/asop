import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/guards';
import { can } from '$lib/server/rbac';
import { audit } from '$lib/server/audit';
import { deleteCloudinaryAsset } from '$lib/server/cloudinary';
import type { RequestHandler } from './$types';

// POST /api/attachments — record a Cloudinary upload in our DB.
// Browser calls this after uploading bytes directly to Cloudinary (PRD § 15.4).

const MAX_FILES_PER_OWNER = 10;
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const VALID_OWNER_TYPES = ['task', 'task_comment', 'report', 'report_comment'] as const;

const postSchema = z.object({
	ownerType: z.enum(VALID_OWNER_TYPES),
	ownerId: z.string().min(1),
	cloudinaryPublicId: z.string().min(1),
	secureUrl: z.string().url(),
	mimeType: z.string().min(1),
	sizeBytes: z.number().int().positive().max(MAX_SIZE_BYTES, 'File exceeds 25 MB limit'),
	originalFilename: z.string().min(1).max(255)
});

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = postSchema.safeParse(raw);
	if (!parsed.success) throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');

	const {
		ownerType,
		ownerId,
		cloudinaryPublicId,
		secureUrl,
		mimeType,
		sizeBytes,
		originalFilename
	} = parsed.data;

	// Count existing (non-deleted) attachments for this owner to enforce the limit.
	const existingCount = await prisma.attachment.count({
		where: { ownerType, ownerId, deletedAt: null }
	});
	if (existingCount >= MAX_FILES_PER_OWNER) {
		throw error(400, `Maximum ${MAX_FILES_PER_OWNER} files per item`);
	}

	const attachment = await prisma.attachment.create({
		data: {
			ownerType,
			ownerId,
			cloudinaryPublicId,
			secureUrl,
			mimeType,
			sizeBytes,
			originalFilename,
			uploadedById: user.id
		}
	});

	return json(attachment, { status: 201 });
};

// DELETE /api/attachments — soft-delete + best-effort Cloudinary destroy.

const deleteSchema = z.object({
	attachmentId: z.string().min(1)
});

export const DELETE: RequestHandler = async (event) => {
	const actor = requireUser(event);

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = deleteSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'attachmentId is required');

	const attachment = await prisma.attachment.findUnique({
		where: { id: parsed.data.attachmentId, deletedAt: null }
	});
	if (!attachment) throw error(404, 'Not found');

	// Resolve the owner's departmentId for the RBAC manager-scope check.
	const ownerDepartmentId = await resolveOwnerDepartmentId(
		attachment.ownerType,
		attachment.ownerId
	);

	if (
		!can(actor, 'attachment.delete', {
			type: 'attachment',
			uploadedById: attachment.uploadedById,
			ownerType: attachment.ownerType,
			ownerDepartmentId
		})
	) {
		throw error(403, 'Forbidden');
	}

	await prisma.$transaction(async (tx) => {
		await tx.attachment.update({
			where: { id: attachment.id },
			data: { deletedAt: new Date() }
		});
		await audit(tx, {
			actorId: actor.id,
			action: 'attachment.deleted',
			target: { type: 'attachment', id: attachment.id },
			before: {
				ownerType: attachment.ownerType,
				ownerId: attachment.ownerId,
				originalFilename: attachment.originalFilename,
				cloudinaryPublicId: attachment.cloudinaryPublicId
			}
		});
	});

	// Best-effort Cloudinary delete — fires after the DB transaction commits.
	void deleteCloudinaryAsset(attachment.cloudinaryPublicId);

	return json({ ok: true });
};

// Resolve the departmentId of the parent entity so the manager-scope check works.
async function resolveOwnerDepartmentId(
	ownerType: string,
	ownerId: string
): Promise<string | null> {
	try {
		if (ownerType === 'task') {
			const task = await prisma.task.findUnique({
				where: { id: ownerId },
				select: { departmentId: true }
			});
			return task?.departmentId ?? null;
		}
		if (ownerType === 'task_comment') {
			const comment = await prisma.taskComment.findUnique({
				where: { id: ownerId },
				select: { task: { select: { departmentId: true } } }
			});
			return comment?.task?.departmentId ?? null;
		}
		if (ownerType === 'report') {
			const report = await prisma.report.findUnique({
				where: { id: ownerId },
				select: { template: { select: { departmentId: true } } }
			});
			return report?.template?.departmentId ?? null;
		}
		if (ownerType === 'report_comment') {
			const comment = await prisma.reportComment.findUnique({
				where: { id: ownerId },
				select: { report: { select: { template: { select: { departmentId: true } } } } }
			});
			return comment?.report?.template?.departmentId ?? null;
		}
	} catch {
		// Non-fatal — fall back to null (admin-only delete on permission failure)
	}
	return null;
}
