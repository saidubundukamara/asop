import { Prisma } from '@prisma/client';

// Append-only audit log writer (PRD § 11.1, FR-AUDIT-1; IMPLEMENTATION_PLAN § 3.5).
//
// Always call this *inside the same Prisma $transaction* as the mutation it
// logs — that way a failed write rolls back the audit entry too. Pass the
// transaction client (`tx`), not the top-level `prisma`, or the audit will
// commit even when its sibling mutation rolls back.
//
// `actorId` is the authenticated user performing the action. It's nullable on
// the table itself (so system/cron writes can land), but every call site in
// Phase 2 is a logged-in actor, so we require it here. Use `null` only if a
// future system writer needs it.

export type AuditAction =
	| 'user.invited'
	| 'user.activated'
	| 'user.deactivated'
	| 'user.role_changed'
	| 'user.edited'
	| 'user.self_updated'
	| 'user.photo_changed'
	// Phase 3 — tasks (FR-AUDIT-1: created, edited, reassigned, deleted; plus
	// restore and comment-delete which the spec implies). Comment create/edit
	// are deliberately NOT audited per FR-AUDIT-1 — only deletes are.
	| 'task.created'
	| 'task.updated'
	| 'task.status_changed'
	| 'task.reassigned'
	| 'task.deleted'
	| 'task.restored'
	| 'task.comment_deleted'
	| 'task_template.created'
	| 'task_template.updated'
	| 'task_template.archived'
	| 'task_template.unarchived'
	// Phase 4 — reports. Only the destructive / irreversible actions are audited
	// per FR-AUDIT-1 (review/approve are not listed there; delete and reopen are).
	| 'report.deleted'
	| 'report.reopened'
	| 'report.comment_deleted'
	| 'report_template.created'
	| 'report_template.updated'
	| 'report_template.archived'
	// Phase 5 — notification preferences and push subscriptions.
	| 'notification.preference_updated'
	| 'push_subscription.registered'
	| 'push_subscription.removed';

export type AuditInput = {
	actorId: string;
	action: AuditAction;
	target: { type: string; id: string };
	before?: unknown;
	after?: unknown;
};

export async function audit(tx: Prisma.TransactionClient, input: AuditInput): Promise<void> {
	await tx.auditLog.create({
		data: {
			actorId: input.actorId,
			action: input.action,
			targetType: input.target.type,
			targetId: input.target.id,
			beforeJson:
				input.before === undefined ? Prisma.JsonNull : (input.before as Prisma.InputJsonValue),
			afterJson:
				input.after === undefined ? Prisma.JsonNull : (input.after as Prisma.InputJsonValue)
		}
	});
}
