import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { audit } from './audit';

// Phase 2 doesn't have a test-DB harness yet (the testing-infra cleanup item
// is deferred), so this test stubs Prisma's transaction client and asserts
// the column mapping — the bit most likely to drift (before → beforeJson,
// target.type → targetType, etc.). The "audit rolls back when its sibling
// mutation rolls back" guarantee is Prisma's, not ours, so we trust it until
// integration tests land.

function makeTx() {
	const create = vi.fn().mockResolvedValue({});
	return { create, tx: { auditLog: { create } } as never };
}

describe('audit()', () => {
	it('maps input → AuditLog columns correctly', async () => {
		const { create, tx } = makeTx();
		await audit(tx, {
			actorId: 'admin-1',
			action: 'user.invited',
			target: { type: 'user', id: 'user-99' },
			before: { role: 'staff' },
			after: { role: 'manager' }
		});

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			data: {
				actorId: 'admin-1',
				action: 'user.invited',
				targetType: 'user',
				targetId: 'user-99',
				beforeJson: { role: 'staff' },
				afterJson: { role: 'manager' }
			}
		});
	});

	it('coerces missing before/after to Prisma.JsonNull (writes SQL NULL into the json column)', async () => {
		const { create, tx } = makeTx();
		await audit(tx, {
			actorId: 'admin-1',
			action: 'user.activated',
			target: { type: 'user', id: 'user-1' }
		});

		const call = create.mock.calls[0][0];
		expect(call.data.beforeJson).toBe(Prisma.JsonNull);
		expect(call.data.afterJson).toBe(Prisma.JsonNull);
	});
});
