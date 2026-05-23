import { describe, it, expect } from 'vitest';
import { can, directoryScope, type Action, type RbacUser, type Resource } from './rbac';

const admin: RbacUser = { id: 'a1', role: 'admin', departmentId: 'd1', isActive: true };
const manager: RbacUser = { id: 'm1', role: 'manager', departmentId: 'd1', isActive: true };
const managerNoDept: RbacUser = { id: 'm2', role: 'manager', departmentId: null, isActive: true };
const staff: RbacUser = { id: 's1', role: 'staff', departmentId: 'd1', isActive: true };
const deactivated: RbacUser = { id: 's2', role: 'admin', departmentId: null, isActive: false };

const selfRes = (u: RbacUser): Resource => ({
	type: 'user',
	id: u.id,
	departmentId: u.departmentId,
	isSelf: true
});
const otherRes = (departmentId: string | null): Resource => ({
	type: 'user',
	id: 'other',
	departmentId,
	isSelf: false
});

describe('directoryScope', () => {
	it('admin → all', () => expect(directoryScope(admin)).toBe('all'));
	it('manager → team', () => expect(directoryScope(manager)).toBe('team'));
	it('staff → self', () => expect(directoryScope(staff)).toBe('self'));
});

describe('can() — user.list (directory access)', () => {
	const dir: Resource = { type: 'directory' };
	it('admin can list', () => expect(can(admin, 'user.list', dir)).toBe(true));
	it('manager can list', () => expect(can(manager, 'user.list', dir)).toBe(true));
	it('staff cannot list', () => expect(can(staff, 'user.list', dir)).toBe(false));
});

describe('can() — user.read', () => {
	it('admin can read any user', () => {
		expect(can(admin, 'user.read', otherRes('d1'))).toBe(true);
		expect(can(admin, 'user.read', otherRes('d2'))).toBe(true);
		expect(can(admin, 'user.read', otherRes(null))).toBe(true);
	});
	it('manager can read same-department users', () => {
		expect(can(manager, 'user.read', otherRes('d1'))).toBe(true);
	});
	it('manager cannot read cross-department users', () => {
		expect(can(manager, 'user.read', otherRes('d2'))).toBe(false);
	});
	it('manager with no department cannot read other users (no leak of unassigned)', () => {
		expect(can(managerNoDept, 'user.read', otherRes(null))).toBe(false);
		expect(can(managerNoDept, 'user.read', otherRes('d1'))).toBe(false);
	});
	it('staff can only read themselves', () => {
		expect(can(staff, 'user.read', selfRes(staff))).toBe(true);
		expect(can(staff, 'user.read', otherRes('d1'))).toBe(false);
	});
	it('every role can read their own profile', () => {
		expect(can(admin, 'user.read', selfRes(admin))).toBe(true);
		expect(can(manager, 'user.read', selfRes(manager))).toBe(true);
		expect(can(staff, 'user.read', selfRes(staff))).toBe(true);
	});
});

describe('can() — admin-only actions', () => {
	const adminOnly: Action[] = [
		'user.invite',
		'user.edit',
		'user.change_role',
		'user.deactivate',
		'user.reactivate'
	];
	for (const action of adminOnly) {
		it(`${action}: admin yes, manager/staff no`, () => {
			expect(can(admin, action, otherRes('d1'))).toBe(true);
			expect(can(manager, action, otherRes('d1'))).toBe(false);
			expect(can(staff, action, otherRes('d1'))).toBe(false);
		});
	}
});

describe('can() — deactivated accounts', () => {
	it('deactivated user cannot do anything, even if they were admin', () => {
		expect(can(deactivated, 'user.list', { type: 'directory' })).toBe(false);
		expect(can(deactivated, 'user.invite', otherRes('d1'))).toBe(false);
		expect(can(deactivated, 'user.read', selfRes(deactivated))).toBe(false);
	});
});

describe('can() — unknown role', () => {
	it('unknown role string fails closed', () => {
		const weird: RbacUser = { id: 'x', role: 'superuser', departmentId: null, isActive: true };
		expect(can(weird, 'user.list', { type: 'directory' })).toBe(false);
	});
});
