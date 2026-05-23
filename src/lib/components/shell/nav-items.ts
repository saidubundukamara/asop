import type { Component } from 'svelte';
import HomeIcon from '@lucide/svelte/icons/house';
import ListChecksIcon from '@lucide/svelte/icons/list-checks';
import FileTextIcon from '@lucide/svelte/icons/file-text';
import InboxIcon from '@lucide/svelte/icons/inbox';
import UserIcon from '@lucide/svelte/icons/user';

export type NavItem = {
	label: string;
	href: string;
	icon: Component;
};

// Phase 1: hardcoded Staff slots. Role-aware variants land in Phase 2 with
// rbac.ts. Hrefs for Tasks/Reports/Inbox/Me point at placeholders that don't
// exist yet — clicking them lands on /dashboard until those routes ship.
export const primaryNav: NavItem[] = [
	{ label: 'Home', href: '/dashboard', icon: HomeIcon },
	{ label: 'Tasks', href: '/tasks', icon: ListChecksIcon },
	{ label: 'Reports', href: '/reports', icon: FileTextIcon },
	{ label: 'Inbox', href: '/inbox', icon: InboxIcon },
	{ label: 'Me', href: '/profile', icon: UserIcon }
];
