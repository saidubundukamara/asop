<script lang="ts">
	import BellIcon from '@lucide/svelte/icons/bell';
	import CheckIcon from '@lucide/svelte/icons/check';
	import FileIcon from '@lucide/svelte/icons/file';
	import UserIcon from '@lucide/svelte/icons/user';
	import ListIcon from '@lucide/svelte/icons/list';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import type { ActivityItem } from '$lib/server/dashboard/summary';

	let {
		items,
		emptyLabel = 'No recent activity yet.'
	}: { items: ActivityItem[]; emptyLabel?: string } = $props();

	const iconMap = {
		bell: BellIcon,
		check: CheckIcon,
		file: FileIcon,
		user: UserIcon,
		log: ListIcon,
		comment: MessageSquareIcon
	} as const;

	const relTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

	function rel(at: Date): string {
		const diffSec = Math.round((at.getTime() - Date.now()) / 1000);
		const abs = Math.abs(diffSec);
		if (abs < 60) return relTime.format(diffSec, 'second');
		if (abs < 3600) return relTime.format(Math.round(diffSec / 60), 'minute');
		if (abs < 86_400) return relTime.format(Math.round(diffSec / 3600), 'hour');
		if (abs < 30 * 86_400) return relTime.format(Math.round(diffSec / 86_400), 'day');
		return relTime.format(Math.round(diffSec / (30 * 86_400)), 'month');
	}
</script>

{#if items.length === 0}
	<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
		{emptyLabel}
	</div>
{:else}
	<ul class="divide-y rounded-lg border bg-card">
		{#each items as item (item.key)}
			{@const Icon = iconMap[item.icon]}
			{@const Wrapper = item.href ? 'a' : 'div'}
			<li>
				<svelte:element
					this={Wrapper}
					href={item.href ?? undefined}
					class={`flex items-start gap-3 p-3 ${item.href ? 'transition-colors hover:bg-muted/50' : ''}`}
				>
					<div
						class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"
					>
						<Icon class="size-4 text-muted-foreground" />
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<div class="truncate text-sm font-medium">{item.title}</div>
							<div class="shrink-0 text-xs text-muted-foreground">{rel(item.at)}</div>
						</div>
						<div class="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</div>
					</div>
				</svelte:element>
			</li>
		{/each}
	</ul>
{/if}
