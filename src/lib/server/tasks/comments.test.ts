import { describe, it, expect } from 'vitest';
import {
	canEditComment,
	canDeleteComment,
	parseMentions,
	COMMENT_EDIT_WINDOW_MS
} from './comments';

const author = { id: 'u-author' };
const otherUser = { id: 'u-other' };
const adminUser = { id: 'u-admin', role: 'admin' };
const managerUser = { role: 'manager' };
const staffUser = { role: 'staff' };

const baseCreated = new Date('2026-05-23T12:00:00Z');
const baseComment = {
	authorId: author.id,
	createdAt: baseCreated,
	deletedAt: null as Date | null
};

describe('canEditComment — 15-minute window', () => {
	it('allows the author at exactly the 15:00 boundary', () => {
		const now = new Date(baseCreated.getTime() + COMMENT_EDIT_WINDOW_MS);
		expect(canEditComment(baseComment, author, now)).toBe(true);
	});

	it('rejects the author one millisecond past 15:00', () => {
		const now = new Date(baseCreated.getTime() + COMMENT_EDIT_WINDOW_MS + 1);
		expect(canEditComment(baseComment, author, now)).toBe(false);
	});

	it('allows immediately after posting', () => {
		const now = new Date(baseCreated.getTime() + 1_000);
		expect(canEditComment(baseComment, author, now)).toBe(true);
	});

	it('rejects negative ages (clock skew protection)', () => {
		const now = new Date(baseCreated.getTime() - 5_000);
		expect(canEditComment(baseComment, author, now)).toBe(false);
	});
});

describe('canEditComment — author scoping', () => {
	it('rejects a non-author user inside the window', () => {
		const now = new Date(baseCreated.getTime() + 60_000);
		expect(canEditComment(baseComment, otherUser, now)).toBe(false);
	});

	it('rejects an admin acting on someone else’s comment (PRD § 12: author-only edit)', () => {
		const now = new Date(baseCreated.getTime() + 60_000);
		expect(canEditComment(baseComment, adminUser, now)).toBe(false);
	});

	it('treats a null authorId (orphaned comment) as un-editable', () => {
		const now = new Date(baseCreated.getTime() + 60_000);
		expect(canEditComment({ ...baseComment, authorId: null }, author, now)).toBe(false);
	});
});

describe('canEditComment — soft-delete short-circuit', () => {
	it('rejects edits on soft-deleted comments', () => {
		const now = new Date(baseCreated.getTime() + 60_000);
		expect(
			canEditComment({ ...baseComment, deletedAt: new Date('2026-05-23T12:05:00Z') }, author, now)
		).toBe(false);
	});
});

describe('canDeleteComment — admin-only', () => {
	it('admin can delete', () => expect(canDeleteComment(adminUser)).toBe(true));
	it('manager cannot delete', () => expect(canDeleteComment(managerUser)).toBe(false));
	it('staff cannot delete', () => expect(canDeleteComment(staffUser)).toBe(false));
});

describe('parseMentions', () => {
	it('extracts a single mention', () => {
		expect(parseMentions('hey @alice can you check this')).toEqual(['alice']);
	});

	it('extracts multiple unique mentions and dedupes', () => {
		expect(parseMentions('@alice please loop in @bob — thanks @alice').sort()).toEqual([
			'alice',
			'bob'
		]);
	});

	it('ignores email addresses (no mention when @ is preceded by a word char)', () => {
		expect(parseMentions('write to user@example.com about this')).toEqual([]);
	});

	it('supports dots in handles (e.g. matching full names like alice.smith)', () => {
		expect(parseMentions('cc @alice.smith')).toEqual(['alice.smith']);
	});

	it('returns an empty list when there are no mentions', () => {
		expect(parseMentions('plain comment with no tags')).toEqual([]);
	});

	it('strips trailing punctuation outside the handle', () => {
		expect(parseMentions('see @alice, thanks!')).toEqual(['alice']);
	});
});
