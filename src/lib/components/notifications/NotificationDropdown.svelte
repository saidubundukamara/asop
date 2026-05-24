<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import NotificationItem from './NotificationItem.svelte';

	type NotifRow = {
		id: string;
		type: string;
		title: string;
		body: string;
		deepLink: string | null;
		readAt: Date | string | null;
		createdAt: Date | string;
	};

	let items = $state<NotifRow[]>([]);
	let loading = $state(false);
	let loaded = $state(false);

	export async function load() {
		if (loaded) return;
		loading = true;
		try {
			const res = await fetch('/api/notifications/recent');
			if (res.ok) {
				const data = (await res.json()) as { notifications: NotifRow[] };
				items = data.notifications;
			}
		} finally {
			loading = false;
			loaded = true;
		}
	}

	async function markAllRead() {
		await fetch('/api/notifications/mark-read', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ all: true })
		});
		items = items.map((n) => ({ ...n, readAt: new Date().toISOString() }));
		await invalidateAll();
	}

	function onItemRead(id: string) {
		items = items.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
	}

	const hasUnread = $derived(items.some((n) => !n.readAt));
</script>

<div class="flex w-80 flex-col">
	<div class="flex items-center justify-between border-b px-4 py-2">
		<span class="text-sm font-semibold">Notifications</span>
		{#if hasUnread}
			<button
				type="button"
				onclick={markAllRead}
				class="text-xs text-muted-foreground hover:text-foreground"
			>
				Mark all read
			</button>
		{/if}
	</div>

	<div class="max-h-96 overflow-y-auto">
		{#if loading}
			<div class="flex items-center justify-center py-8 text-sm text-muted-foreground">
				Loading…
			</div>
		{:else if items.length === 0}
			<div class="flex items-center justify-center py-8 text-sm text-muted-foreground">
				No notifications yet
			</div>
		{:else}
			{#each items as notif (notif.id)}
				<NotificationItem notification={notif} onRead={onItemRead} />
			{/each}
		{/if}
	</div>

	<div class="border-t px-4 py-2">
		<a href="/notifications" class="text-xs text-muted-foreground hover:text-foreground">
			See all notifications →
		</a>
	</div>
</div>
