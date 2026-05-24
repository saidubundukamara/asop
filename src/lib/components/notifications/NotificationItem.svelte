<script lang="ts">
	type NotifRow = {
		id: string;
		title: string;
		body: string;
		deepLink: string | null;
		readAt: Date | string | null;
		createdAt: Date | string;
	};

	let { notification, onRead }: { notification: NotifRow; onRead?: (id: string) => void } =
		$props();

	const href = $derived(notification.deepLink ?? '/notifications');
	const isUnread = $derived(!notification.readAt);

	function timeAgo(date: Date | string): string {
		const ms = Date.now() - new Date(date).getTime();
		const sec = Math.floor(ms / 1000);
		const min = Math.floor(sec / 60);
		const hr = Math.floor(min / 60);
		const day = Math.floor(hr / 24);
		const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
		if (day > 0) return rtf.format(-day, 'day');
		if (hr > 0) return rtf.format(-hr, 'hour');
		if (min > 0) return rtf.format(-min, 'minute');
		return 'just now';
	}

	async function handleClick() {
		if (isUnread && onRead) {
			onRead(notification.id);
		}
		if (!isUnread) return;
		// Optimistically mark read via API (fire-and-forget).
		fetch('/api/notifications/mark-read', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ids: [notification.id] })
		}).catch(() => {});
	}
</script>

<a
	{href}
	onclick={handleClick}
	class="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50
		{isUnread ? 'border-l-2 border-primary bg-primary/5' : ''}"
>
	<!-- Unread dot -->
	<div class="mt-1.5 shrink-0">
		{#if isUnread}
			<span class="block size-2 rounded-full bg-primary"></span>
		{:else}
			<span class="block size-2 rounded-full bg-transparent"></span>
		{/if}
	</div>

	<div class="min-w-0 flex-1">
		<p class="truncate text-sm leading-snug font-medium {isUnread ? '' : 'text-muted-foreground'}">
			{notification.title}
		</p>
		<p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
		<p class="mt-1 text-xs text-muted-foreground/70">{timeAgo(notification.createdAt)}</p>
	</div>
</a>
