<script lang="ts">
	import SummaryCard from '$lib/components/dashboard/SummaryCard.svelte';
	import QuickActions from '$lib/components/dashboard/QuickActions.svelte';
	import ActivityFeed from '$lib/components/dashboard/ActivityFeed.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const d = $derived(data.dashboard);

	const greeting = $derived(
		d.role === 'admin'
			? 'Overview'
			: d.role === 'manager'
				? 'Your team'
				: `Hi, ${data.user.name?.split(' ')[0] ?? ''}`
	);

	const activityLabel = $derived(
		d.role === 'admin'
			? 'Recent activity'
			: d.role === 'manager'
				? 'Recent team submissions'
				: 'Recent activity'
	);
</script>

<div class="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
	<header class="mb-6 flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight md:text-3xl">{greeting}</h1>
		<p class="text-sm text-muted-foreground">
			Signed in as <span class="font-medium text-foreground">{data.user.email}</span> · {data.user
				.role}
		</p>
	</header>

	<section aria-label="Summary" class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
		{#each d.cards as card (card.label)}
			<SummaryCard {card} />
		{/each}
	</section>

	{#if d.quickActions.length > 0}
		<section aria-label="Quick actions" class="mt-6">
			<QuickActions actions={d.quickActions} />
		</section>
	{/if}

	<section aria-labelledby="activity-heading" class="mt-8">
		<h2
			id="activity-heading"
			class="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
		>
			{activityLabel}
		</h2>
		<ActivityFeed items={d.activity} />
	</section>
</div>
