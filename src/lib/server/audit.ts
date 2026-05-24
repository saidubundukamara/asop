import { Prisma } from '@prisma/client';

// Append-only audit log writer (PRD § 11.1, FR-AUDIT-1; IMPLEMENTATION_PLAN § 3.5).
//
// Always call this *inside the same Prisma $transaction* as the mutation it
// logs — that way a failed write rolls back the audit entry too. Pass the
// transaction client (`tx`), not the top-level `prisma`, or the audit will
// commit even when its sibling mutation rolls back.
//
// `actorId` is the authenticated user performing the action; it may be `null`
// for system writes (cron) or unauthenticated-flow auditing (rate-limit hits
// on /sign-in, /forgot-password, /accept-invite — Phase 9). The column itself
// is nullable.

export const AUDIT_ACTIONS = [
	'user.invited',
	'user.activated',
	'user.deactivated',
	'user.role_changed',
	'user.edited',
	'user.self_updated',
	'user.photo_changed',
	'user.signed_out_everywhere',
	// Phase 3 — tasks (FR-AUDIT-1: created, edited, reassigned, deleted; plus
	// restore and comment-delete which the spec implies). Comment create/edit
	// are deliberately NOT audited per FR-AUDIT-1 — only deletes are.
	'task.created',
	'task.updated',
	'task.status_changed',
	'task.reassigned',
	'task.deleted',
	'task.restored',
	'task.comment_deleted',
	'task_template.created',
	'task_template.updated',
	'task_template.archived',
	'task_template.unarchived',
	// Phase 4 — reports. Only the destructive / irreversible actions are audited
	// per FR-AUDIT-1 (review/approve are not listed there; delete and reopen are).
	'report.deleted',
	'report.reopened',
	'report.comment_deleted',
	'report_template.created',
	'report_template.updated',
	'report_template.archived',
	// Phase 5 — notification preferences and push subscriptions.
	'notification.preference_updated',
	'push_subscription.registered',
	'push_subscription.removed',
	// Phase 6 — attachments (FR-FILE-3: deletion is audited).
	'attachment.deleted',
	// Phase 9 — unauthenticated-flow security events. `actorId` is null on
	// these rows; the target carries the inferred subject (email for sign-in /
	// forgot, a hashed token for invite).
	'auth.sign_in_failure',
	'auth.forgot_password_throttled',
	'auth.invite_throttled'
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditInput = {
	actorId: string | null;
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
