import { describe, it, expect } from 'vitest';
import type { TaskStatus } from '@prisma/client';
import { canTransition, allowedTransitions, type TransitionActor } from './transitions';

const admin: TransitionActor = { role: 'admin', isAssignee: false };
const manager: TransitionActor = { role: 'manager', isAssignee: false };
const staff: TransitionActor = { role: 'staff', isAssignee: true };
const otherStaff: TransitionActor = { role: 'staff', isAssignee: false };

describe('canTransition — staff (own task) — PRD § 7.3.2', () => {
	const allowed: Array<[TaskStatus, TaskStatus]> = [
		['assigned', 'in_progress'],
		['in_progress', 'assigned'],
		['in_progress', 'submitted'],
		['assigned', 'blocked'],
		['in_progress', 'blocked'],
		['blocked', 'in_progress']
	];
	for (const [from, to] of allowed) {
		it(`allows ${from} → ${to}`, () => expect(canTransition(staff, from, to)).toBe(true));
	}

	const forbidden: Array<[TaskStatus, TaskStatus]> = [
		['assigned', 'submitted'],
		['assigned', 'completed'],
		['in_progress', 'completed'],
		['submitted', 'completed'],
		['submitted', 'in_progress'],
		['completed', 'in_progress'],
		['cancelled', 'in_progress']
	];
	for (const [from, to] of forbidden) {
		it(`forbids ${from} → ${to}`, () => expect(canTransition(staff, from, to)).toBe(false));
	}

	it('staff who is not the assignee gets nothing', () => {
		expect(canTransition(otherStaff, 'assigned', 'in_progress')).toBe(false);
		expect(canTransition(otherStaff, 'in_progress', 'submitted')).toBe(false);
	});
});

describe('canTransition — manager', () => {
	it('moves any → any within the team', () => {
		expect(canTransition(manager, 'submitted', 'completed')).toBe(true);
		expect(canTransition(manager, 'in_progress', 'cancelled')).toBe(true);
		expect(canTransition(manager, 'blocked', 'in_progress')).toBe(true);
	});
	it('cannot reopen a completed task (admin-only)', () => {
		expect(canTransition(manager, 'completed', 'in_progress')).toBe(false);
		expect(canTransition(manager, 'completed', 'assigned')).toBe(false);
	});
});

describe('canTransition — admin', () => {
	it('moves anything to anything, including reopen-from-completed', () => {
		expect(canTransition(admin, 'completed', 'in_progress')).toBe(true);
		expect(canTransition(admin, 'cancelled', 'assigned')).toBe(true);
	});
});

describe('canTransition — invariants', () => {
	it('from === to is never a valid transition', () => {
		for (const s of [
			'assigned',
			'in_progress',
			'submitted',
			'completed',
			'blocked',
			'cancelled'
		] as TaskStatus[]) {
			expect(canTransition(admin, s, s)).toBe(false);
			expect(canTransition(manager, s, s)).toBe(false);
			expect(canTransition(staff, s, s)).toBe(false);
		}
	});
	it('unknown role fails closed', () => {
		expect(canTransition({ role: 'visitor', isAssignee: true }, 'assigned', 'in_progress')).toBe(
			false
		);
	});
});

describe('allowedTransitions', () => {
	it('staff on an assigned task can start or block', () => {
		expect(allowedTransitions(staff, 'assigned').sort()).toEqual(['blocked', 'in_progress']);
	});
	it('staff on a submitted task has no further moves', () => {
		expect(allowedTransitions(staff, 'submitted')).toEqual([]);
	});
	it('admin on a completed task can reopen to any other state', () => {
		expect(allowedTransitions(admin, 'completed')).toEqual([
			'assigned',
			'in_progress',
			'submitted',
			'blocked',
			'cancelled'
		]);
	});
	it('manager on a completed task gets nothing (admin-only reopen)', () => {
		expect(allowedTransitions(manager, 'completed')).toEqual([]);
	});
});
