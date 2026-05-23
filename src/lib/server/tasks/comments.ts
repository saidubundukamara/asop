// FR-TASK-6 — task comments.
//
// PRD § 7.3.6: "Comments cannot be edited after 15 minutes; deletion is
// admin-only and logged." Encoded here as pure functions so the UI hides
// the edit affordance and the server action rejects late edits from the
// same source of truth.
//
// Tests inject `now` so we don't depend on system clock skew.

export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;

export type CommentEditCheck = {
	authorId: string | null;
	createdAt: Date;
	deletedAt: Date | null;
};

export function canEditComment(
	comment: CommentEditCheck,
	user: { id: string },
	now: Date
): boolean {
	if (comment.deletedAt) return false;
	if (!comment.authorId || comment.authorId !== user.id) return false;
	const ageMs = now.getTime() - comment.createdAt.getTime();
	return ageMs >= 0 && ageMs <= COMMENT_EDIT_WINDOW_MS;
}

export function canDeleteComment(user: { role: string }): boolean {
	return user.role === 'admin';
}

// Parse `@handle` mentions out of a comment body into a list of candidate
// handles. Resolution against the user directory happens in the route action;
// the parser here just isolates the candidates so the action can do one
// `findMany({ where: { name: { in: handles } } })`.
//
// Handle rule: word characters and dots, 1..60 chars, NOT preceded by a word
// character (so "user@example.com" is not parsed as a @example mention).
const MENTION_RE = /(?<![\w@])@([\w.][\w.-]{0,59})/g;

export function parseMentions(body: string): string[] {
	const found = new Set<string>();
	for (const match of body.matchAll(MENTION_RE)) {
		found.add(match[1]);
	}
	return [...found];
}
