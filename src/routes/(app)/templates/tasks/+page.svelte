<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import TaskTemplateSheet from '$lib/components/tasks/TaskTemplateSheet.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const createOpen = $derived(page.url.searchParams.get('action') === 'create');

	function openCreate() {
		const url = new URL(page.url);
		url.searchParams.set('action', 'create');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: false, noScroll: true });
	}

	function toggleArchived() {
		const url = new URL(page.url);
		if (data.showArchived) url.searchParams.delete('showArchived');
		else url.searchParams.set('showArchived', '1');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url);
	}

	let busyId = $state<string | null>(null);
</script>

<svelte:head><title>Task templates · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-4xl px-4 py-6 md:py-10">
	<header class="mb-4 flex items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">Task templates</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.templates.length}
				{data.templates.length === 1 ? 'template' : 'templates'}
			</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={toggleArchived}>
				{data.showArchived ? 'Hide archived' : 'Show archived'}
			</Button>
			<Button onclick={openCreate}>
				<PlusIcon class="size-4" />
				<span class="hidden sm:inline">New template</span>
			</Button>
		</div>
	</header>

	{#if data.templates.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">No templates yet.</p>
		</div>
	{:else}
		<ul class="divide-y rounded-lg border">
			{#each data.templates as tpl (tpl.id)}
				<li class="flex flex-wrap items-center gap-3 px-4 py-3" class:opacity-60={tpl.isArchived}>
					<div class="min-w-0 flex-1">
						<a href={`/templates/tasks/${tpl.id}`} class="font-medium hover:underline">
							{tpl.name}
						</a>
						<div class="mt-0.5 text-xs text-muted-foreground">
							{tpl.defaultPriority} priority
							{#if tpl.defaultDepartment}· {tpl.defaultDepartment.name}{/if}
							{#if tpl.dueDateOffsetDays !== null}· due in {tpl.dueDateOffsetDays}d{/if}
						</div>
					</div>
					{#if tpl.isArchived}
						<form
							method="POST"
							action="?/unarchive"
							use:enhance={() => {
								busyId = tpl.id;
								return async ({ result, update }) => {
									busyId = null;
									await update({ reset: false });
									if (result.type === 'success') toast.success('Template restored');
									else toast.error('Could not restore');
								};
							}}
						>
							<input type="hidden" name="id" value={tpl.id} />
							<Button type="submit" variant="outline" size="sm" disabled={busyId === tpl.id}>
								Restore
							</Button>
						</form>
					{:else}
						<form
							method="POST"
							action="?/archive"
							use:enhance={() => {
								busyId = tpl.id;
								return async ({ result, update }) => {
									busyId = null;
									await update({ reset: false });
									if (result.type === 'success') toast.success('Template archived');
									else toast.error('Could not archive');
								};
							}}
						>
							<input type="hidden" name="id" value={tpl.id} />
							<Button type="submit" variant="outline" size="sm" disabled={busyId === tpl.id}>
								Archive
							</Button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<TaskTemplateSheet
	open={createOpen}
	mode="create"
	departments={data.departments}
	template={null}
	actionPath="?/create"
/>
