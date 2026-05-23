import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { requireUser, requireCan } from '$lib/server/auth/guards';
import { withAction } from '$lib/server/actions';
import { audit } from '$lib/server/audit';
import { can, directoryScope } from '$lib/server/rbac';
import { canTransition, allowedTransitions } from '$lib/server/tasks/transitions';
import { canEditComment, canDeleteComment, parseMentions } from '$lib/server/tasks/comments';
import { sanitizeRichTextCapped } from '$lib/server/sanitize';
import type { Actions, PageServerLoad } from './$types';

// FR-TASK-5 — task detail. All field/status/comment mutations live here.
// Per-action capability flags computed in load() so the page can hide buttons
// the user can't act on; every action also re-checks via requireCan() (UI is
// never authoritative — see CLAUDE.md "auth in components" note).

type TaskScopeFields = {
	id: string;
	assigneeId: string;
	assignerId: string | null;
	departmentId: string | null;
	status: string;
	deletedAt: Date | null;
};

function taskResource(task: TaskScopeFields) {
	return {
		type: 'task' as const,
		assigneeId: task.assigneeId,
		assignerId: task.assignerId,
		departmentId: task.departmentId,
		isCompleted: task.status === 'completed'
	};
}

export const load: PageServerLoad = async (event) => {
	const actor = requireUser(event);
	const { id } = event.params;
	const showDeleted = event.url.searchParams.get('showDeleted') === '1';

	const task = await prisma.task.findUnique({
		where: { id },
		select: {
			id: true,
			title: true,
			description: true,
			status: true,
			priority: true,
			dueDate: true,
			createdAt: true,
			updatedAt: true,
			completedAt: true,
			deletedAt: true,
			assigneeId: true,
			assignerId: true,
			departmentId: true,
			templateId: true,
			assignee: { select: { id: true, name: true, email: true, photoUrl: true } },
			assigner: { select: { id: true, name: true } },
			department: { select: { id: true, name: true } },
			template: { select: { id: true, name: true } },
			statusEvents: {
				orderBy: { at: 'desc' },
				take: 50,
				select: {
					id: true,
					fromStatus: true,
					toStatus: true,
					at: true,
					note: true,
					actor: { select: { id: true, name: true } }
				}
			},
			comments: {
				where: { deletedAt: null },
				orderBy: { createdAt: 'desc' },
				select: {
					id: true,
					body: true,
					mentionedUserIds: true,
					createdAt: true,
					editedAt: true,
					author: { select: { id: true, name: true, photoUrl: true } }
				}
			}
		}
	});
	if (!task) throw error(404, 'Not found');

	// Visibility check first — 404 (not 403) so the existence of out-of-scope
	// tasks isn't revealed. Matches the staff/[id] precedent.
	const resource = taskResource(task);
	if (!can(actor, 'task.read', resource)) throw error(404, 'Not found');

	// Soft-deleted tasks: only admin sees them, only when explicitly asking.
	if (task.deletedAt && !(actor.role === 'admin' && showDeleted)) {
		throw error(404, 'Not found');
	}

	const scope = directoryScope(actor);
	const assigneeOptions = await prisma.user.findMany({
		where: {
			isActive: true,
			...(scope === 'team' ? { departmentId: actor.departmentId ?? '___none___' } : {})
		},
		orderBy: { name: 'asc' },
		take: 100,
		select: { id: true, name: true, photoUrl: true }
	});

	const departments =
		actor.role === 'admin'
			? await prisma.department.findMany({
					orderBy: { name: 'asc' },
					select: { id: true, name: true }
				})
			: [];

	const now = new Date();

	return {
		task,
		assigneeOptions,
		departments,
		canEdit: can(actor, 'task.update_fields', resource),
		canUpdateStatus: can(actor, 'task.update_status', resource),
		canReassign: can(actor, 'task.reassign', resource),
		canDelete: can(actor, 'task.delete', resource),
		canRestore: can(actor, 'task.restore', resource) && !!task.deletedAt,
		canComment: can(actor, 'task.comment.create', { type: 'task_list' }) && !task.deletedAt,
		canDeleteAnyComment: canDeleteComment(actor),
		allowedTransitions: allowedTransitions(
			{ role: actor.role, isAssignee: task.assigneeId === actor.id },
			task.status
		),
		commentEditFlags: task.comments.map((c) => ({
			id: c.id,
			canEdit: canEditComment(
				{ authorId: c.author?.id ?? null, createdAt: c.createdAt, deletedAt: null },
				{ id: actor.id },
				now
			)
		})),
		actor: { id: actor.id, role: actor.role }
	};
};

// --- Schemas ---

const updateStatusSchema = z.object({
	to: z.enum(['assigned', 'in_progress', 'submitted', 'completed', 'blocked', 'cancelled']),
	note: z
		.string()
		.trim()
		.max(500)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null))
});

const updateFieldsSchema = z.object({
	title: z.string().trim().min(1, 'Title is required').max(140),
	description: z.string().optional().default(''),
	priority: z.enum(['low', 'medium', 'high']),
	dueDate: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	departmentId: z
		.string()
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null))
});

const reassignSchema = z.object({
	assigneeId: z.string().min(1, 'Pick an assignee'),
	reason: z
		.string()
		.trim()
		.max(500)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null))
});

const commentSchema = z.object({
	body: z.string().trim().min(1, 'Comment is empty').max(5000)
});

const commentEditSchema = z.object({
	commentId: z.string().min(1),
	body: z.string().trim().min(1, 'Comment is empty').max(5000)
});

const commentDeleteSchema = z.object({ commentId: z.string().min(1) });

// --- Helpers ---

async function loadTaskScope(id: string): Promise<TaskScopeFields> {
	const task = await prisma.task.findUnique({
		where: { id },
		select: {
			id: true,
			assigneeId: true,
			assignerId: true,
			departmentId: true,
			status: true,
			deletedAt: true
		}
	});
	if (!task) throw error(404, 'Not found');
	return task;
}

// --- Actions ---

export const actions: Actions = {
	updateStatus: withAction(updateStatusSchema, async (input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const before = await loadTaskScope(id);
		if (before.deletedAt) throw error(404, 'Not found');

		requireCan(actor, 'task.update_status', taskResource(before));

		if (
			!canTransition(
				{ role: actor.role, isAssignee: before.assigneeId === actor.id },
				before.status as never,
				input.to
			)
		) {
			throw error(403, 'Illegal status transition');
		}

		await prisma.$transaction(async (tx) => {
			await tx.task.update({
				where: { id },
				data: {
					status: input.to,
					completedAt: input.to === 'completed' ? new Date() : null
				}
			});
			await tx.taskStatusEvent.create({
				data: {
					taskId: id,
					fromStatus: before.status as never,
					toStatus: input.to,
					actorId: actor.id,
					note: input.note
				}
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'task.status_changed',
				target: { type: 'task', id },
				before: { status: before.status },
				after: { status: input.to }
			});
		});

		// TODO(Phase 5): notify({ recipientId: assignerId, type: 'task.status_changed', ... })
		return { ok: true, data: { id, to: input.to } };
	}),

	updateFields: withAction(updateFieldsSchema, async (input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const before = await prisma.task.findUnique({
			where: { id },
			select: {
				id: true,
				title: true,
				description: true,
				priority: true,
				dueDate: true,
				assigneeId: true,
				assignerId: true,
				departmentId: true,
				status: true,
				deletedAt: true
			}
		});
		if (!before) throw error(404, 'Not found');
		if (before.deletedAt) throw error(404, 'Not found');

		requireCan(actor, 'task.update_fields', taskResource(before));

		const sanitized = sanitizeRichTextCapped(input.description);
		if (!sanitized.ok) {
			const issues: Record<string, string[]> = { description: ['Description is too long'] };
			return { ok: false as const, issues };
		}

		let dueDate: Date | null = null;
		if (input.dueDate) {
			const d = new Date(input.dueDate);
			if (Number.isNaN(d.getTime())) {
				const issues: Record<string, string[]> = { dueDate: ['Pick a valid date'] };
				return { ok: false as const, issues };
			}
			dueDate = d;
		}

		await prisma.$transaction(async (tx) => {
			const after = await tx.task.update({
				where: { id },
				data: {
					title: input.title,
					description: sanitized.html === '' ? null : sanitized.html,
					priority: input.priority,
					dueDate,
					departmentId: input.departmentId
				},
				select: {
					title: true,
					priority: true,
					dueDate: true,
					departmentId: true
				}
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'task.updated',
				target: { type: 'task', id },
				before: {
					title: before.title,
					priority: before.priority,
					dueDate: before.dueDate?.toISOString() ?? null,
					departmentId: before.departmentId
				},
				after: {
					title: after.title,
					priority: after.priority,
					dueDate: after.dueDate?.toISOString() ?? null,
					departmentId: after.departmentId
				}
			});
		});

		return { ok: true, data: { id } };
	}),

	reassign: withAction(reassignSchema, async (input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const before = await loadTaskScope(id);
		if (before.deletedAt) throw error(404, 'Not found');

		requireCan(actor, 'task.reassign', taskResource(before));

		const scope = directoryScope(actor);
		const newAssignee = await prisma.user.findFirst({
			where: {
				id: input.assigneeId,
				isActive: true,
				...(scope === 'team' ? { departmentId: actor.departmentId ?? '___none___' } : {})
			},
			select: { id: true, name: true }
		});
		if (!newAssignee) {
			const issues: Record<string, string[]> = {
				assigneeId: ['Pick an active assignee in scope']
			};
			return { ok: false as const, issues };
		}
		if (newAssignee.id === before.assigneeId) {
			const issues: Record<string, string[]> = {
				assigneeId: ['Task is already assigned to them']
			};
			return { ok: false as const, issues };
		}

		await prisma.$transaction(async (tx) => {
			await tx.task.update({
				where: { id },
				data: { assigneeId: newAssignee.id }
			});
			await tx.taskStatusEvent.create({
				data: {
					taskId: id,
					fromStatus: before.status as never,
					toStatus: before.status as never,
					actorId: actor.id,
					note: `Reassigned to ${newAssignee.name}${input.reason ? ` — ${input.reason}` : ''}`
				}
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'task.reassigned',
				target: { type: 'task', id },
				before: { assigneeId: before.assigneeId },
				after: { assigneeId: newAssignee.id }
			});
		});

		// TODO(Phase 5): notify new assignee + old assignee
		return { ok: true, data: { id, assigneeId: newAssignee.id } };
	}),

	delete: withAction(z.object({}), async (_input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const before = await loadTaskScope(id);
		if (before.deletedAt) throw error(400, 'Already deleted');

		requireCan(actor, 'task.delete', taskResource(before));

		await prisma.$transaction(async (tx) => {
			await tx.task.update({ where: { id }, data: { deletedAt: new Date() } });
			await audit(tx, {
				actorId: actor.id,
				action: 'task.deleted',
				target: { type: 'task', id },
				before: { deletedAt: null },
				after: { deletedAt: new Date().toISOString() }
			});
		});

		throw redirect(303, '/tasks');
	}),

	restore: withAction(z.object({}), async (_input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const before = await loadTaskScope(id);
		if (!before.deletedAt) {
			const issues: Record<string, string[]> = { _: ['Task is not deleted'] };
			return { ok: false as const, issues };
		}
		const previousDeletedAt = before.deletedAt;

		requireCan(actor, 'task.restore', taskResource(before));

		await prisma.$transaction(async (tx) => {
			await tx.task.update({ where: { id }, data: { deletedAt: null } });
			await audit(tx, {
				actorId: actor.id,
				action: 'task.restored',
				target: { type: 'task', id },
				before: { deletedAt: previousDeletedAt.toISOString() },
				after: { deletedAt: null }
			});
		});

		return { ok: true, data: { id } };
	}),

	addComment: withAction(commentSchema, async (input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const taskScope = await loadTaskScope(id);
		if (taskScope.deletedAt) throw error(404, 'Not found');

		// Comment access piggybacks on read access to the parent task.
		requireCan(actor, 'task.read', taskResource(taskScope));

		// Resolve @mentions to user ids by exact name match (case-insensitive).
		// Phase 5 will use mentionedUserIds to dispatch notifications; for now
		// they're persisted but inert.
		const handles = parseMentions(input.body);
		let mentionedUserIds: string[] = [];
		if (handles.length > 0) {
			const matches = await prisma.user.findMany({
				where: {
					isActive: true,
					OR: handles.map((h) => ({ name: { equals: h, mode: 'insensitive' as const } }))
				},
				select: { id: true }
			});
			mentionedUserIds = matches.map((m) => m.id);
		}

		const created = await prisma.taskComment.create({
			data: {
				taskId: id,
				authorId: actor.id,
				body: input.body,
				mentionedUserIds
			},
			select: { id: true }
		});

		// FR-AUDIT-1 does not list comment creates; no audit entry.
		return { ok: true, data: { id: created.id } };
	}),

	editComment: withAction(commentEditSchema, async (input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const comment = await prisma.taskComment.findFirst({
			where: { id: input.commentId, taskId: id },
			select: { id: true, authorId: true, createdAt: true, deletedAt: true }
		});
		if (!comment) throw error(404, 'Not found');

		requireCan(actor, 'task.comment.edit', {
			type: 'task_comment',
			authorId: comment.authorId
		});

		if (
			!canEditComment(
				{ authorId: comment.authorId, createdAt: comment.createdAt, deletedAt: comment.deletedAt },
				{ id: actor.id },
				new Date()
			)
		) {
			throw error(403, 'Edit window has closed');
		}

		await prisma.taskComment.update({
			where: { id: input.commentId },
			data: { body: input.body, editedAt: new Date() }
		});

		return { ok: true, data: { id: input.commentId } };
	}),

	deleteComment: withAction(commentDeleteSchema, async (input, event) => {
		const actor = requireUser(event);
		const { id } = event.params;
		if (!id) throw error(400, 'Missing id');

		const comment = await prisma.taskComment.findFirst({
			where: { id: input.commentId, taskId: id },
			select: { id: true, authorId: true, deletedAt: true }
		});
		if (!comment) throw error(404, 'Not found');
		if (comment.deletedAt) throw error(400, 'Already deleted');

		requireCan(actor, 'task.comment.delete', {
			type: 'task_comment',
			authorId: comment.authorId
		});

		await prisma.$transaction(async (tx) => {
			await tx.taskComment.update({
				where: { id: input.commentId },
				data: { deletedAt: new Date() }
			});
			await audit(tx, {
				actorId: actor.id,
				action: 'task.comment_deleted',
				target: { type: 'task_comment', id: input.commentId },
				before: { authorId: comment.authorId }
			});
		});

		return { ok: true, data: { id: input.commentId } };
	})
};
