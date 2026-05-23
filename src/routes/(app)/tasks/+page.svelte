<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import TaskList from '$lib/components/tasks/TaskList.svelte';
	import TaskFilters from '$lib/components/tasks/TaskFilters.svelte';
	import CreateTaskSheet from '$lib/components/tasks/CreateTaskSheet.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const createOpen = $derived(data.canCreate && page.url.searchParams.get('action') === 'create');

	function openCreate() {
		const url = new URL(page.url);
		url.searchParams.set('action', 'create');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: false, noScroll: true });
	}

	function gotoPage(p: number) {
		const url = new URL(page.url);
		url.searchParams.set('page', String(p));
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url);
	}

	const title = $derived(
		data.isTrash
			? 'Trash'
			: data.view === 'my'
				? 'My tasks'
				: data.view === 'team'
					? 'Team tasks'
					: 'All tasks'
	);
</script>

<svelte:head><title>Tasks · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6 md:py-10">
	<header class="mb-4 flex items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.pagination.total}
				{data.pagination.total === 1 ? 'task' : 'tasks'}
			</p>
		</div>
		{#if data.canCreate && !data.isTrash}
			<Button onclick={openCreate}>
				<PlusIcon class="size-4" />
				<span class="hidden sm:inline">New task</span>
			</Button>
		{/if}
	</header>

	<TaskFilters
		filters={data.filters}
		departments={data.departments}
		teamUsers={data.teamUsers}
		view={data.view}
		isTrash={data.isTrash}
		canSeeTrash={data.canSeeTrash}
		showAllOption={data.actor.role === 'admin'}
	/>

	<TaskList tasks={data.tasks} />

	{#if data.pagination.pageCount > 1}
		<div class="mt-4 flex items-center justify-between text-sm">
			<span class="text-muted-foreground">
				Page {data.pagination.page} of {data.pagination.pageCount}
			</span>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page <= 1}
					onclick={() => gotoPage(data.pagination.page - 1)}>Previous</Button
				>
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page >= data.pagination.pageCount}
					onclick={() => gotoPage(data.pagination.page + 1)}>Next</Button
				>
			</div>
		</div>
	{/if}
</div>

{#if data.canCreate}
	<CreateTaskSheet
		open={createOpen}
		templates={data.templates}
		assignees={data.teamUsers}
		departments={data.departments}
		prefill={data.prefill}
	/>
{/if}
