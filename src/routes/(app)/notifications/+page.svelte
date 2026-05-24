<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import BellOffIcon from '@lucide/svelte/icons/bell-off';
	import { Button } from '$lib/components/ui/button';
	import NotificationItem from '$lib/components/notifications/NotificationItem.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function setFilter(value: string) {
		const url = new URL(page.url);
		if (value === 'all') url.searchParams.delete('filter');
		else url.searchParams.set('filter', value);
		url.searchParams.delete('page');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: false });
	}
</script>

<svelte:head><title>Notifications · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 md:py-10">
	<header class="mb-4 flex items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">Notifications</h1>
			{#if data.unreadCount > 0}
				<p class="mt-1 text-sm text-muted-foreground">{data.unreadCount} unread</p>
			{/if}
		</div>
		{#if data.unreadCount > 0}
			<form method="POST" action="?/markAllRead" use:enhance>
				<Button variant="outline" size="sm" type="submit">Mark all read</Button>
			</form>
		{/if}
	</header>

	<!-- Filter tabs -->
	<div class="mb-4 flex gap-1">
		{#each [{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }] as tab (tab.value)}
			<button
				type="button"
				onclick={() => setFilter(tab.value)}
				class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors
					{data.filter === tab.value
					? 'bg-foreground text-background'
					: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if data.notifications.length === 0}
		<div class="flex flex-col items-center gap-3 py-16 text-muted-foreground">
			<BellOffIcon class="size-8 opacity-40" />
			<p class="text-sm">
				{data.filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
			</p>
		</div>
	{:else}
		<div class="divide-y rounded-lg border">
			{#each data.notifications as notif (notif.id)}
				<NotificationItem notification={notif} />
			{/each}
		</div>
	{/if}

	<!-- Pagination -->
	{#if data.totalPages > 1}
		<div class="mt-6 flex items-center justify-center gap-2">
			{#if data.page > 1}
				<a href="?page={data.page - 1}" class="text-sm text-muted-foreground hover:underline">
					← Previous
				</a>
			{/if}
			<span class="text-sm text-muted-foreground">Page {data.page} of {data.totalPages}</span>
			{#if data.page < data.totalPages}
				<a href="?page={data.page + 1}" class="text-sm text-muted-foreground hover:underline">
					Next →
				</a>
			{/if}
		</div>
	{/if}
</div>
