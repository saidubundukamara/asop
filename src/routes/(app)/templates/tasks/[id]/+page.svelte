<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import TaskTemplateSheet from '$lib/components/tasks/TaskTemplateSheet.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const editOpen = $derived(page.url.searchParams.get('action') === 'edit');

	function openEdit() {
		const url = new URL(page.url);
		url.searchParams.set('action', 'edit');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: false, noScroll: true });
	}

	function fmtDate(d: Date | string): string {
		return new Date(d).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head><title>{data.template.name} · Templates</title></svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-10">
	<a
		href="/templates/tasks"
		class="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="mr-1 size-4" /> Back to templates
	</a>

	<header class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">{data.template.name}</h1>
			<p class="mt-1 text-xs text-muted-foreground">
				Created {fmtDate(data.template.createdAt)}
				{#if data.template.createdBy}· by {data.template.createdBy.name}{/if}
				{#if data.template.isArchived}· archived{/if}
			</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={openEdit}>
				<PencilIcon class="size-4" /><span class="hidden sm:inline">Edit</span>
			</Button>
			<Button size="sm" href={`/tasks?action=create&templateId=${data.template.id}`}>
				<PlayIcon class="size-4" /><span class="hidden sm:inline">Use template</span>
			</Button>
		</div>
	</header>

	<Card>
		<CardHeader><CardTitle class="text-base">Defaults</CardTitle></CardHeader>
		<CardContent>
			<dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
				<div>
					<dt class="text-xs text-muted-foreground">Priority</dt>
					<dd class="mt-0.5 capitalize">{data.template.defaultPriority}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted-foreground">Program</dt>
					<dd class="mt-0.5">{data.template.defaultDepartment?.name ?? '—'}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted-foreground">Due offset</dt>
					<dd class="mt-0.5">
						{data.template.dueDateOffsetDays !== null
							? `${data.template.dueDateOffsetDays} days`
							: '—'}
					</dd>
				</div>
			</dl>
		</CardContent>
	</Card>

	{#if data.template.defaultDescription}
		<Card class="mt-4">
			<CardHeader><CardTitle class="text-base">Default description</CardTitle></CardHeader>
			<CardContent>
				<!-- defaultDescription is sanitized server-side before persistence -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="prose prose-sm max-w-none">{@html data.template.defaultDescription}</div>
			</CardContent>
		</Card>
	{/if}
</div>

<TaskTemplateSheet
	open={editOpen}
	mode="update"
	departments={data.departments}
	template={data.template}
	actionPath="?/update"
/>
