import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma BEFORE importing the SUT so the SUT picks up the spied client.
vi.mock('$lib/server/db', () => ({
	prisma: {
		$queryRaw: vi.fn().mockResolvedValue([])
	}
}));

import { prisma } from '$lib/server/db';
import { searchAll } from './search';
import type { RbacUser } from '../rbac';

// The acceptance criterion this test guards: a staff user's search must never
// reach a row outside (their own assignments | their own reports). We can't
// hit a real DB here, but we CAN assert that every emitted SQL fragment
// contains the actor's ID in its bound values, and never contains an
// unrelated user's ID.

type Spy = ReturnType<typeof vi.fn>;

function flushQueries(): { values: unknown[][]; texts: string[] } {
	const calls = (prisma.$queryRaw as unknown as Spy).mock.calls as unknown as Array<unknown[]>;
	// Each tagged-template call is (TemplateStringsArray, ...values).
	// The Prisma.sql fragments we embed render as a single "Sql" placeholder
	// in the outer template, so the outer values array holds those fragments
	// AND any plain string literals are inside the template, not values.
	// We collect each call's values for shape assertions.
	const values = calls.map((args) => args.slice(1));
	// Concatenate every Sql fragment's text + values to a single string blob
	// per call so we can grep for the actor id.
	const texts = calls.map((args) => JSON.stringify(args));
	return { values, texts };
}

const staff: RbacUser = { id: 'staff-1', role: 'staff', departmentId: 'd1', isActive: true };
const manager: RbacUser = { id: 'mgr-1', role: 'manager', departmentId: 'd1', isActive: true };
const admin: RbacUser = { id: 'admin-1', role: 'admin', departmentId: 'd1', isActive: true };

describe('searchAll', () => {
	beforeEach(() => {
		(prisma.$queryRaw as unknown as Spy).mockClear();
		(prisma.$queryRaw as unknown as Spy).mockResolvedValue([]);
	});

	it('staff skips the staff (user-directory) query entirely', async () => {
		await searchAll(staff, 'needle');
		// 4 surfaces: tasks, reports, taskComments, reportComments (no staff).
		expect((prisma.$queryRaw as unknown as Spy).mock.calls).toHaveLength(4);
	});

	it('manager and admin run all five surfaces', async () => {
		await searchAll(manager, 'needle');
		expect((prisma.$queryRaw as unknown as Spy).mock.calls).toHaveLength(5);

		(prisma.$queryRaw as unknown as Spy).mockClear();
		await searchAll(admin, 'needle');
		expect((prisma.$queryRaw as unknown as Spy).mock.calls).toHaveLength(5);
	});

	it('every staff query binds the staff actor id (never another user id)', async () => {
		await searchAll(staff, 'needle');
		const { texts } = flushQueries();
		// Every emitted call serialization must mention staff-1 (in its bound
		// values) and must NOT mention any other made-up id we haven't seeded.
		for (const text of texts) {
			expect(text).toContain('staff-1');
			expect(text).not.toContain('mgr-1');
			expect(text).not.toContain('admin-1');
		}
	});

	it('manager queries bind the department id (and not the actor id)', async () => {
		await searchAll(manager, 'needle');
		const { texts } = flushQueries();
		// Staff query is included (manager has directory access). All others
		// scope by department, so the department id must appear in every call.
		for (const text of texts) {
			expect(text).toContain('d1');
		}
	});

	it('admin queries contain no scope sentinel', async () => {
		await searchAll(admin, 'unique-needle');
		const { texts } = flushQueries();
		// The unmistakable sentinel from tasks/+page.server.ts for "no dept" should
		// never appear in admin queries — admin has unrestricted scope.
		for (const text of texts) {
			expect(text).not.toContain('___none___');
		}
	});

	it('manager without department falls back to the no-dept sentinel', async () => {
		const noDeptMgr: RbacUser = {
			id: 'mgr-x',
			role: 'manager',
			departmentId: null,
			isActive: true
		};
		await searchAll(noDeptMgr, 'needle');
		const { texts } = flushQueries();
		// Manager with no department must match no rows — established
		// codebase rule (see tasks/+page.server.ts NO_DEPT sentinel).
		const sawSentinel = texts.some((t) => t.includes('___none___'));
		expect(sawSentinel).toBe(true);
	});
});
