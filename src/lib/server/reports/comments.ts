// FR-REP-8 — report comments.
//
// Same lifecycle rules as task comments (FR-TASK-6): author can edit within
// 15 minutes; deletion is admin-only and logged. Mirrors the shape of
// src/lib/server/tasks/comments.ts so the two are easy to compare.
//
// parseMentions is re-exported from the task module — there is only one
// implementation of the mention-parsing regex.

export { parseMentions } from '$lib/server/tasks/comments.js';

export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;

export type ReportCommentEditCheck = {
	authorId: string | null;
	createdAt: Date;
	deletedAt: Date | null;
};

export function canEditReportComment(
	comment: ReportCommentEditCheck,
	user: { id: string },
	now: Date
): boolean {
	if (comment.deletedAt) return false;
	if (!comment.authorId || comment.authorId !== user.id) return false;
	const ageMs = now.getTime() - comment.createdAt.getTime();
	return ageMs >= 0 && ageMs <= COMMENT_EDIT_WINDOW_MS;
}

export function canDeleteReportComment(user: { role: string }): boolean {
	return user.role === 'admin';
}
