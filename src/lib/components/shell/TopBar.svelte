<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import UserIcon from '@lucide/svelte/icons/user';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { Avatar, AvatarFallback } from '$lib/components/ui/avatar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import NotificationBell from '$lib/components/notifications/NotificationBell.svelte';

	const user = $derived(page.data.user);
	const initials = $derived(
		(user?.name ?? user?.email ?? '?')
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('')
	);
	const canManageStaff = $derived(user?.role === 'admin' || user?.role === 'manager');
</script>

<header
	class="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md md:px-6"
	style="padding-top: var(--safe-top);"
>
	<a href="/dashboard" class="flex items-center gap-2 font-semibold tracking-tight">
		<span
			class="inline-flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
			>A</span
		>
		<span class="hidden sm:inline">ADSAT Ops</span>
	</a>

	<div class="flex-1"></div>

	<NotificationBell />

	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label="User menu"
				>
					<Avatar>
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
				</button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-56">
			<DropdownMenu.Label>
				<div class="text-sm font-medium">{user?.name ?? user?.email}</div>
				<div class="text-xs text-muted-foreground">{user?.role}</div>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a {...props} href="/profile" class="flex items-center gap-2">
						<UserIcon class="size-4" />
						Profile
					</a>
				{/snippet}
			</DropdownMenu.Item>
			{#if canManageStaff}
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<a {...props} href="/staff" class="flex items-center gap-2">
							<UsersIcon class="size-4" />
							Staff
						</a>
					{/snippet}
				</DropdownMenu.Item>
			{/if}
			<DropdownMenu.Separator />
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<form method="POST" action="/?/signOut" use:enhance class="w-full">
						<button {...props} type="submit" class="flex w-full items-center gap-2 text-left">
							<LogOutIcon class="size-4" />
							Sign out
						</button>
					</form>
				{/snippet}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</header>
