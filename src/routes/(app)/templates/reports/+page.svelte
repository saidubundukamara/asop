<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
	import ReportTemplateSheet from '$lib/components/reports/ReportTemplateSheet.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const createOpen = $derived(page.url.searchParams.get('action') === 'create');

	function openCreate() {
		const url = new URL(page.url);
		url.searchParams.set('action', 'create');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: false, noScroll: true });
	}

	function toggleInactive() {
		const url = new URL(page.url);
		if (data.showInactive) url.searchParams.delete('showInactive');
		else url.searchParams.set('showInactive', '1');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url);
	}

	let busyId = $state<string | null>(null);
</script>

<svelte:head><title>Report templates · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-4xl px-4 py-6 md:py-10">
	<header class="mb-4 flex items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">Report templates</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.templates.length}
				{data.templates.length === 1 ? 'template' : 'templates'}
			</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={toggleInactive}>
				{data.showInactive ? 'Hide inactive' : 'Show all versions'}
			</Button>
			<Button onclick={openCreate}>
				<PlusIcon class="size-4" />
				<span class="hidden sm:inline">New template</span>
			</Button>
		</div>
	</header>

	{#if data.templates.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">
				No report templates yet. Create one to get started.
			</p>
		</div>
	{:else}
		<ul class="divide-y rounded-lg border">
			{#each data.templates as tpl (tpl.id)}
				<li class="flex flex-wrap items-center gap-3 px-4 py-3" class:opacity-60={!tpl.isActive}>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<a href={`/templates/reports/${tpl.id}`} class="font-medium hover:underline">
								{tpl.name}
							</a>
							<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
								v{tpl.version}
							</span>
							{#if !tpl.isActive}
								<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
									inactive
								</span>
							{/if}
						</div>
						<div class="mt-0.5 text-xs text-muted-foreground">
							{tpl._count.fields}
							{tpl._count.fields === 1 ? 'field' : 'fields'}
							{#if tpl.department}· {tpl.department.name}{/if}
							· reviewed by {tpl.reviewerRole}
						</div>
					</div>
					{#if tpl.isActive}
						<form
							method="POST"
							action="?/archive"
							use:enhance={() => {
								busyId = tpl.id;
								return async ({ result, update }) => {
									busyId = null;
									await update({ reset: false });
									if (result.type === 'success') toast.success('Template deactivated');
									else toast.error('Could not deactivate');
								};
							}}
						>
							<input type="hidden" name="id" value={tpl.id} />
							<Button type="submit" variant="outline" size="sm" disabled={busyId === tpl.id}>
								Deactivate
							</Button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<ReportTemplateSheet open={createOpen} departments={data.departments} actionPath="?/create" />
