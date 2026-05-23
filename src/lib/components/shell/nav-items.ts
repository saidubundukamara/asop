import type { Component } from 'svelte';
import HomeIcon from '@lucide/svelte/icons/house';
import ListChecksIcon from '@lucide/svelte/icons/list-checks';
import FileTextIcon from '@lucide/svelte/icons/file-text';
import InboxIcon from '@lucide/svelte/icons/inbox';
import UserIcon from '@lucide/svelte/icons/user';
import UsersIcon from '@lucide/svelte/icons/users';
import FileCogIcon from '@lucide/svelte/icons/file-cog';

export type NavItem = {
	label: string;
	href: string;
	icon: Component;
};

export type Role = 'admin' | 'manager' | 'staff';

// The 5 mobile tab-bar slots stay fixed across roles per IMPLEMENTATION_PLAN
// § 2.2 — uneven counts make the grid look broken. Routes that don't exist
// yet (tasks/reports/inbox) are placeholders that land on /dashboard until
// their phases ship.
export const primaryNav: NavItem[] = [
	{ label: 'Home', href: '/dashboard', icon: HomeIcon },
	{ label: 'Tasks', href: '/tasks', icon: ListChecksIcon },
	{ label: 'Reports', href: '/reports', icon: FileTextIcon },
	{ label: 'Inbox', href: '/inbox', icon: InboxIcon },
	{ label: 'Me', href: '/profile', icon: UserIcon }
];

// Desktop sidebar secondary nav (role-gated). The mobile tab bar deliberately
// does NOT gain a Staff slot — admin/manager reach /staff via the sidebar on
// desktop and via "Me" + secondary links on mobile (Phase 2 keeps the link
// in the avatar dropdown until the Me screen builds out post-Phase 5).
//
// Phase 3 splits this: only admin sees Task templates (FR-TASK-8); managers
// still see Staff.
const staffNav: NavItem = { label: 'Staff', href: '/staff', icon: UsersIcon };
const taskTemplatesNav: NavItem = {
	label: 'Task templates',
	href: '/templates/tasks',
	icon: FileCogIcon
};

export const adminNav: NavItem[] = [staffNav, taskTemplatesNav];
export const managerNav: NavItem[] = [staffNav];

export function secondaryNavForRole(role: Role | string | undefined): NavItem[] {
	if (role === 'admin') return adminNav;
	if (role === 'manager') return managerNav;
	return [];
}
