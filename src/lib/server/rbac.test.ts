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

// --- Phase 3 — Tasks (PRD § 12 task rows) ---

const taskRes = (overrides?: Partial<Extract<Resource, { type: 'task' }>>): Resource => ({
	type: 'task',
	assigneeId: 'other-user',
	assignerId: null,
	departmentId: 'd1',
	isCompleted: false,
	...overrides
});

describe('can() — task.read', () => {
	it('admin reads any task', () => {
		expect(can(admin, 'task.read', taskRes({ departmentId: 'd2' }))).toBe(true);
	});
	it('manager reads same-department tasks', () => {
		expect(can(manager, 'task.read', taskRes({ departmentId: 'd1' }))).toBe(true);
		expect(can(manager, 'task.read', taskRes({ departmentId: 'd2' }))).toBe(false);
	});
	it('manager with no department reads nothing they did not author or get assigned', () => {
		expect(can(managerNoDept, 'task.read', taskRes({ departmentId: null }))).toBe(false);
	});
	it('assignee reads their own task regardless of department', () => {
		expect(can(staff, 'task.read', taskRes({ assigneeId: staff.id, departmentId: 'd9' }))).toBe(
			true
		);
	});
	it('assigner reads tasks they created regardless of department', () => {
		expect(can(staff, 'task.read', taskRes({ assignerId: staff.id, departmentId: 'd9' }))).toBe(
			true
		);
	});
	it('staff cannot read other staff tasks', () => {
		expect(can(staff, 'task.read', taskRes({ assigneeId: 'someone-else' }))).toBe(false);
	});
});

describe('can() — task.create', () => {
	it('admin and manager can create; staff cannot', () => {
		expect(can(admin, 'task.create', { type: 'task_list' })).toBe(true);
		expect(can(manager, 'task.create', { type: 'task_list' })).toBe(true);
		expect(can(staff, 'task.create', { type: 'task_list' })).toBe(false);
	});
});

describe('can() — task.update_fields', () => {
	it('admin edits any task (even completed)', () => {
		expect(can(admin, 'task.update_fields', taskRes({ isCompleted: true }))).toBe(true);
	});
	it('manager edits same-department non-completed; locked once completed', () => {
		expect(can(manager, 'task.update_fields', taskRes({ departmentId: 'd1' }))).toBe(true);
		expect(
			can(manager, 'task.update_fields', taskRes({ departmentId: 'd1', isCompleted: true }))
		).toBe(false);
		expect(can(manager, 'task.update_fields', taskRes({ departmentId: 'd2' }))).toBe(false);
	});
	it('staff cannot edit task fields (status-only mutations go through update_status)', () => {
		expect(can(staff, 'task.update_fields', taskRes({ assigneeId: staff.id }))).toBe(false);
	});
});

describe('can() — task.update_status', () => {
	it('admin can transition any task', () => {
		expect(can(admin, 'task.update_status', taskRes({ departmentId: 'd9' }))).toBe(true);
	});
	it('manager scoped to same department', () => {
		expect(can(manager, 'task.update_status', taskRes({ departmentId: 'd1' }))).toBe(true);
		expect(can(manager, 'task.update_status', taskRes({ departmentId: 'd2' }))).toBe(false);
	});
	it('staff can transition only their own tasks', () => {
		expect(can(staff, 'task.update_status', taskRes({ assigneeId: staff.id }))).toBe(true);
		expect(can(staff, 'task.update_status', taskRes({ assigneeId: 'someone-else' }))).toBe(false);
	});
});

describe('can() — task.reassign / delete / restore', () => {
	it('reassign: admin yes, manager team, staff no', () => {
		expect(can(admin, 'task.reassign', taskRes())).toBe(true);
		expect(can(manager, 'task.reassign', taskRes({ departmentId: 'd1' }))).toBe(true);
		expect(can(manager, 'task.reassign', taskRes({ departmentId: 'd2' }))).toBe(false);
		expect(can(staff, 'task.reassign', taskRes({ assigneeId: staff.id }))).toBe(false);
	});
	it('delete + restore are admin-only', () => {
		expect(can(admin, 'task.delete', taskRes())).toBe(true);
		expect(can(manager, 'task.delete', taskRes({ departmentId: 'd1' }))).toBe(false);
		expect(can(admin, 'task.restore', taskRes())).toBe(true);
		expect(can(manager, 'task.restore', taskRes({ departmentId: 'd1' }))).toBe(false);
	});
});

describe('can() — task comments', () => {
	it('anyone signed in can attempt to create a comment (route gates on task.read)', () => {
		expect(can(staff, 'task.comment.create', { type: 'task_list' })).toBe(true);
	});
	it('author-only edit, even for admin acting on someone else’s comment', () => {
		expect(
			can(admin, 'task.comment.edit', { type: 'task_comment', authorId: 'someone-else' })
		).toBe(false);
		expect(can(staff, 'task.comment.edit', { type: 'task_comment', authorId: staff.id })).toBe(
			true
		);
	});
	it('delete is admin-only', () => {
		expect(can(admin, 'task.comment.delete', { type: 'task_comment', authorId: 'whoever' })).toBe(
			true
		);
		expect(can(manager, 'task.comment.delete', { type: 'task_comment', authorId: 'whoever' })).toBe(
			false
		);
	});
});

describe('can() — task templates', () => {
	it('all roles can read templates', () => {
		const res: Resource = { type: 'task_template' };
		expect(can(admin, 'task_template.read', res)).toBe(true);
		expect(can(manager, 'task_template.read', res)).toBe(true);
		expect(can(staff, 'task_template.read', res)).toBe(true);
	});
	it('only admin can create/update/archive', () => {
		const res: Resource = { type: 'task_template' };
		expect(can(admin, 'task_template.create', res)).toBe(true);
		expect(can(manager, 'task_template.create', res)).toBe(false);
		expect(can(admin, 'task_template.update', res)).toBe(true);
		expect(can(staff, 'task_template.update', res)).toBe(false);
		expect(can(admin, 'task_template.archive', res)).toBe(true);
		expect(can(manager, 'task_template.archive', res)).toBe(false);
	});
});
