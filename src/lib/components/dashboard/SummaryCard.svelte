<script lang="ts">
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import type { SummaryCardData } from '$lib/server/dashboard/summary';

	let { card }: { card: SummaryCardData } = $props();

	const trendColor = $derived(
		card.trend?.direction === 'up'
			? 'text-emerald-600'
			: card.trend?.direction === 'down'
				? 'text-red-600'
				: 'text-muted-foreground'
	);
</script>

<a
	href={card.href}
	class="group flex min-h-[112px] flex-col justify-between rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
>
	<div class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{card.label}</div>
	<div class="flex items-end justify-between gap-2">
		<div class="text-3xl font-semibold tabular-nums">{card.value}</div>
		{#if card.trend}
			<div class={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
				{#if card.trend.direction === 'up'}
					<ArrowUpIcon class="size-3" />
				{:else if card.trend.direction === 'down'}
					<ArrowDownIcon class="size-3" />
				{:else}
					<MinusIcon class="size-3" />
				{/if}
				{card.trend.deltaPct === null ? 'new' : `${Math.abs(card.trend.deltaPct)}%`}
			</div>
		{/if}
	</div>
</a>
