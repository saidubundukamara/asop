<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import ReportList from '$lib/components/reports/ReportList.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const statusOptions = [
		{ value: '', label: 'All' },
		{ value: 'draft', label: 'Drafts' },
		{ value: 'submitted', label: 'Submitted' },
		{ value: 'under_review', label: 'Under review' },
		{ value: 'needs_revision', label: 'Needs revision' },
		{ value: 'approved', label: 'Approved' }
	];

	const tabLabel =
		data.scope === 'self' ? 'My Reports' : data.scope === 'team' ? 'Team Reports' : 'All Reports';

	function setFilter(key: string, value: string) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		url.searchParams.delete('page');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: false });
	}
</script>

<svelte:head><title>Reports · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-4xl px-4 py-6 md:py-10">
	<header class="mb-4 flex items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">{tabLabel}</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.total}
				{data.total === 1 ? 'report' : 'reports'}
			</p>
		</div>
		<a href="/reports/new">
			<Button>
				<PlusIcon class="size-4" />
				<span class="hidden sm:inline">Submit report</span>
			</Button>
		</a>
	</header>

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap gap-2">
		<div class="flex items-center gap-1 text-sm">
			<span class="text-muted-foreground">Status:</span>
			<div class="flex gap-1">
				{#each statusOptions as opt (opt.value)}
					<button
						type="button"
						onclick={() => setFilter('status', opt.value)}
						class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors
							{(data.filters.status ?? '') === opt.value
							? 'bg-foreground text-background'
							: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		{#if data.templates.length > 0}
			<select
				class="rounded-md border px-2 py-1 text-xs"
				value={data.filters.templateId ?? ''}
				onchange={(e) => setFilter('templateId', (e.target as HTMLSelectElement).value)}
			>
				<option value="">All templates</option>
				{#each data.templates as tpl (tpl.id)}
					<option value={tpl.id}>{tpl.name}</option>
				{/each}
			</select>
		{/if}
	</div>

	<ReportList reports={data.reports} />

	<!-- Pagination -->
	{#if data.totalPages > 1}
		<div class="mt-6 flex items-center justify-center gap-2">
			{#if data.page > 1}
				<a href="?page={data.page - 1}" class="text-sm text-muted-foreground hover:underline">
					← Previous
				</a>
			{/if}
			<span class="text-sm text-muted-foreground">
				Page {data.page} of {data.totalPages}
			</span>
			{#if data.page < data.totalPages}
				<a href="?page={data.page + 1}" class="text-sm text-muted-foreground hover:underline">
					Next →
				</a>
			{/if}
		</div>
	{/if}
</div>
