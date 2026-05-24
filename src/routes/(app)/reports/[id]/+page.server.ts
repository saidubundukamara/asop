import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import { can } from '$lib/server/rbac';
import { canTransitionReport } from '$lib/server/reports/lifecycle';
import {
	canEditReportComment,
	canDeleteReportComment,
	parseMentions
} from '$lib/server/reports/comments';
import { notify } from '$lib/server/notify';
import { NOTIFICATION_TYPES } from '$lib/server/notifications/types';
import type { Actions, PageServerLoad } from './$types';

// FR-REP-4 / FR-REP-8 — report detail + review workflow + comments.

type ReportScopeFields = {
	authorId: string;
	departmentId: string | null;
	status: string;
};

function reportResource(r: ReportScopeFields) {
	return {
		type: 'report' as const,
		authorId: r.authorId,
		departmentId: r.departmentId,
		status: r.status
	};
}

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);

	const report = await prisma.report.findUnique({
		where: { id: event.params.id },
		select: {
			id: true,
			status: true,
			templateVersion: true,
			submittedAt: true,
			reviewedAt: true,
			createdAt: true,
			updatedAt: true,
			authorId: true,
			reviewerId: true,
			taskId: true,
			template: {
				select: {
					id: true,
					name: true,
					description: true,
					departmentId: true,
					reviewerRole: true,
					version: true,
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
			},
			author: { select: { id: true, name: true, email: true, photoUrl: true } },
			reviewer: { select: { id: true, name: true } },
			task: { select: { id: true, title: true, status: true } },
			fieldValues: {
				select: {
					fieldId: true,
					valueText: true,
					valueNumber: true,
					valueDate: true,
					valueJson: true
				}
			},
			comments: {
				where: { deletedAt: null },
				orderBy: { createdAt: 'asc' },
				select: {
					id: true,
					body: true,
					createdAt: true,
					editedAt: true,
					authorId: true,
					author: { select: { id: true, name: true, photoUrl: true } }
				}
			}
		}
	});
	if (!report) throw error(404, 'Report not found');

	const res = reportResource({ ...report, departmentId: report.template.departmentId });

	if (!can(actor, 'report.read', res)) throw error(403, 'Access denied');

	// Compute capability flags (mirrored in actions for server-side re-assertion).
	const now = new Date();
	const canReview = can(actor, 'report.review', res);
	const canReopen = can(actor, 'report.reopen', res);
	const canEdit = report.status === 'draft' && can(actor, 'report.update_fields', res);
	const canDelete = can(actor, 'report.delete', res);
	const canComment = can(actor, 'report.comment.create', { type: 'report_list' });

	// Index field values by fieldId for the template renderer.
	const valuesByFieldId: Record<
		string,
		{ valueText: string | null; valueNumber: unknown; valueDate: Date | null; valueJson: unknown }
	> = {};
	for (const fv of report.fieldValues) {
		valuesByFieldId[fv.fieldId] = {
			valueText: fv.valueText,
			valueNumber: fv.valueNumber,
			valueDate: fv.valueDate,
			valueJson: fv.valueJson
		};
	}

	// Comment-level flags (edit window per comment).
	const commentsWithFlags = report.comments.map((c) => ({
		...c,
		canEdit: canEditReportComment(
			{ authorId: c.authorId, createdAt: c.createdAt, deletedAt: null },
			actor,
			now
		),
		canDelete: canDeleteReportComment(actor)
	}));

	return {
		report: {
			...report,
			comments: commentsWithFlags,
			valuesByFieldId
		},
		capabilities: { canReview, canReopen, canEdit, canDelete, canComment },
		actor: { id: actor.id, role: actor.role }
	};
};

// --- Actions ---

const reviewSchema = z
	.object({
		reportId: z.string().min(1),
		decision: z.enum(['approve', 'request_revision']),
		comment: z.string().optional().default('')
	})
	.refine((d) => d.decision === 'approve' || d.comment.trim().length > 0, {
		message: 'A comment is required when requesting revision',
		path: ['comment']
	});

const reopenSchema = z.object({ reportId: z.string().min(1) });

const commentSchema = z.object({
	reportId: z.string().min(1),
	body: z.string().trim().min(1, 'Comment cannot be empty').max(10_000)
});

const editCommentSchema = z.object({
	commentId: z.string().min(1),
	body: z.string().trim().min(1).max(10_000)
});

const deleteReportSchema = z.object({ reportId: z.string().min(1) });
const deleteCommentSchema = z.object({ commentId: z.string().min(1) });

export const actions: Actions = {
	review: withAction(reviewSchema, async (input, event) => {
		const actor = requireUser(event);

		const report = await prisma.report.findUnique({
			where: { id: input.reportId },
			select: {
				id: true,
				authorId: true,
				status: true,
				template: { select: { departmentId: true } }
			}
		});
		if (!report) throw error(404, 'Report not found');

		const res = reportResource({
			authorId: report.authorId,
			departmentId: report.template.departmentId,
			status: report.status
		});
		requireCan(actor, 'report.review', res);

		const toStatus = input.decision === 'approve' ? 'approved' : 'needs_revision';

		if (
			!canTransitionReport(
				{ id: actor.id, role: actor.role, departmentId: actor.departmentId },
				{
					authorId: report.authorId,
					departmentId: report.template.departmentId,
					status: report.status as 'submitted' | 'under_review'
				},
				toStatus
			)
		) {
			throw error(400, `Cannot move report from ${report.status} to ${toStatus}`);
		}

		await prisma.$transaction(async (tx) => {
			await tx.report.update({
				where: { id: report.id },
				data: {
					status: toStatus,
					reviewerId: actor.id,
					reviewedAt: new Date()
				}
			});
			// For revision requests, store the comment as a report comment.
			if (input.decision === 'request_revision' && input.comment.trim()) {
				const mentions = parseMentions(input.comment);
				const mentionedUsers =
					mentions.length > 0
						? await tx.user.findMany({
								where: { name: { in: mentions }, isActive: true },
								select: { id: true }
							})
						: [];
				await tx.reportComment.create({
					data: {
						reportId: report.id,
						authorId: actor.id,
						body: input.comment.trim(),
						mentionedUserIds: mentionedUsers.map((u) => u.id)
					}
				});
			}
		});

		// Notify the report author of the review outcome — fire-and-forget.
		if (report.authorId !== actor.id) {
			const notifType =
				toStatus === 'approved'
					? NOTIFICATION_TYPES.REPORT_APPROVED
					: NOTIFICATION_TYPES.REPORT_NEEDS_REVISION;
			notify({
				recipientId: report.authorId,
				type: notifType,
				title: toStatus === 'approved' ? 'Report approved' : 'Report needs revision',
				body:
					toStatus === 'approved'
						? 'Your report has been approved.'
						: input.comment?.trim() || 'Your report needs revision.',
				deepLink: `/reports/${input.reportId}`
			}).catch(() => {});
		}

		return { ok: true, data: { status: toStatus } };
	}),

	reopen: withAction(reopenSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'report.reopen', { type: 'report_list' });

		const report = await prisma.report.findUnique({
			where: { id: input.reportId },
			select: {
				id: true,
				status: true,
				authorId: true,
				template: { select: { departmentId: true } }
			}
		});
		if (!report) throw error(404, 'Report not found');
		if (report.status !== 'approved') throw error(400, 'Only approved reports can be reopened');

		await prisma.$transaction(async (tx) => {
			await tx.report.update({
				where: { id: report.id },
				data: { status: 'submitted', reviewedAt: null }
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'report.reopened',
				target: { type: 'report', id: report.id },
				before: { status: 'approved' },
				after: { status: 'submitted' }
			});
		});

		return { ok: true, data: { id: report.id } };
	}),

	addComment: withAction(commentSchema, async (input, event) => {
		const actor = requireUser(event);

		const report = await prisma.report.findUnique({
			where: { id: input.reportId },
			select: {
				id: true,
				authorId: true,
				template: { select: { departmentId: true } },
				status: true
			}
		});
		if (!report) throw error(404);
		const res = reportResource({
			authorId: report.authorId,
			departmentId: report.template.departmentId,
			status: report.status
		});
		if (!can(actor, 'report.read', res)) throw error(403);

		const mentions = parseMentions(input.body);
		const mentionedUsers =
			mentions.length > 0
				? await prisma.user.findMany({
						where: { name: { in: mentions }, isActive: true },
						select: { id: true }
					})
				: [];

		const mentionedUserIds = mentionedUsers.map((u) => u.id);

		const comment = await prisma.reportComment.create({
			data: {
				reportId: report.id,
				authorId: actor.id,
				body: input.body,
				mentionedUserIds
			},
			select: { id: true }
		});

		// Notify report author and mentioned users — fire-and-forget.
		const notified = new Set<string>([actor.id]);
		if (!notified.has(report.authorId)) {
			notified.add(report.authorId);
			notify({
				recipientId: report.authorId,
				type: NOTIFICATION_TYPES.REPORT_COMMENT,
				title: 'New comment on your report',
				body: input.body.replace(/<[^>]+>/g, '').slice(0, 120),
				deepLink: `/reports/${report.id}`
			}).catch(() => {});
		}
		for (const uid of mentionedUserIds) {
			if (!notified.has(uid)) {
				notified.add(uid);
				notify({
					recipientId: uid,
					type: NOTIFICATION_TYPES.REPORT_MENTION,
					title: 'You were mentioned in a report',
					body: input.body.replace(/<[^>]+>/g, '').slice(0, 120),
					deepLink: `/reports/${report.id}`
				}).catch(() => {});
			}
		}

		return { ok: true, data: { commentId: comment.id } };
	}),

	editComment: withAction(editCommentSchema, async (input, event) => {
		const actor = requireUser(event);

		const comment = await prisma.reportComment.findUnique({
			where: { id: input.commentId },
			select: { id: true, authorId: true, createdAt: true, deletedAt: true }
		});
		if (!comment) throw error(404);

		if (!canEditReportComment(comment, actor, new Date())) {
			throw error(403, 'Edit window has expired or you are not the author');
		}

		await prisma.reportComment.update({
			where: { id: comment.id },
			data: { body: input.body, editedAt: new Date() }
		});

		return { ok: true, data: { commentId: comment.id } };
	}),

	delete: withAction(deleteReportSchema, async (input, event) => {
		const actor = requireUser(event);
		requireCan(actor, 'report.delete', { type: 'report_list' });

		const report = await prisma.report.findUnique({
			where: { id: input.reportId },
			select: { id: true, status: true, authorId: true, templateId: true }
		});
		if (!report) throw error(404, 'Report not found');

		await prisma.$transaction(async (tx) => {
			await tx.report.delete({ where: { id: report.id } });
			await audit(tx, {
				actorId: actor.id,
				action: 'report.deleted',
				target: { type: 'report', id: report.id },
				before: { status: report.status, authorId: report.authorId }
			});
		});

		redirect(303, '/reports');
	}),

	deleteComment: withAction(deleteCommentSchema, async (input, event) => {
		const actor = requireUser(event);

		if (!canDeleteReportComment(actor)) throw error(403, 'Admin only');

		const comment = await prisma.reportComment.findUnique({
			where: { id: input.commentId },
			select: { id: true, reportId: true, body: true }
		});
		if (!comment) throw error(404);

		await prisma.$transaction(async (tx) => {
			await tx.reportComment.update({
				where: { id: comment.id },
				data: { deletedAt: new Date() }
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'report.comment_deleted',
				target: { type: 'report_comment', id: comment.id },
				before: { reportId: comment.reportId }
			});
		});

		return { ok: true, data: { commentId: comment.id } };
	})
};
