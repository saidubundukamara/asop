<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const entries = $derived(data.entries);
	const expanded = new SvelteSet<string>();

	function toggle(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}

	function fmtWhen(d: Date | string) {
		const date = typeof d === 'string' ? new Date(d) : d;
		return new Intl.DateTimeFormat(undefined, {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).format(date);
	}

	// Map action prefix → chip color. Single source for the visual grouping
	// used both in the table and (potentially) the filter dropdown.
	function chipClass(action: string): string {
		const prefix = action.split('.')[0];
		switch (prefix) {
			case 'user':
				return 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200';
			case 'task':
				return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200';
			case 'task_template':
				return 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200';
			case 'report':
				return 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200';
			case 'report_template':
				return 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200';
			case 'attachment':
				return 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200';
			case 'notification':
				return 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200';
			case 'push_subscription':
				return 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200';
			case 'auth':
				return 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}

	// Build a deep-link to the target entity when we know the convention.
	function targetHref(targetType: string, targetId: string): string | null {
		if (targetType === 'user') return `/staff/${targetId}`;
		if (targetType === 'task') return `/tasks/${targetId}`;
		if (targetType === 'report') return `/reports/${targetId}`;
		if (targetType === 'task_template') return `/templates/tasks/${targetId}`;
		if (targetType === 'report_template') return `/templates/reports/${targetId}`;
		return null;
	}

	// Pagination hrefs are derived from the current filter set, not from
	// window.location, so a back/forward in history can't desync them with what
	// the server actually filtered. Build params explicitly to dodge the
	// SvelteURLSearchParams lint rule (these aren't reactive state).
	function pageHref(page: number): string {
		const parts: string[] = [];
		if (data.filters.actor) parts.push(`actor=${encodeURIComponent(data.filters.actor)}`);
		if (data.filters.action) parts.push(`action=${encodeURIComponent(data.filters.action)}`);
		if (data.filters.targetType)
			parts.push(`targetType=${encodeURIComponent(data.filters.targetType)}`);
		if (data.filters.from) parts.push(`from=${encodeURIComponent(data.filters.from)}`);
		if (data.filters.to) parts.push(`to=${encodeURIComponent(data.filters.to)}`);
		if (page > 1) parts.push(`page=${page}`);
		return parts.length ? '?' + parts.join('&') : '?';
	}

	// Mirror the GET filter form into hidden inputs on the CSV export POST so
	// the export honors whatever the operator is currently looking at.
	const hiddenFilters = $derived([
		{ name: 'actor', value: data.filters.actor },
		{ name: 'action', value: data.filters.action },
		{ name: 'targetType', value: data.filters.targetType },
		{ name: 'from', value: data.filters.from },
		{ name: 'to', value: data.filters.to }
	]);
</script>

<svelte:head><title>Audit log · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-6xl px-4 py-6 md:py-10">
	<header class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">Audit log</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Append-only history of sensitive actions. {data.total.toLocaleString()}
				total {data.total === 1 ? 'entry' : 'entries'}.
			</p>
		</div>

		<form method="POST" action="?/exportCsv" class="flex-shrink-0">
			{#each hiddenFilters as f (f.name)}
				{#if f.value}
					<input type="hidden" name={f.name} value={f.value} />
				{/if}
			{/each}
			<Button type="submit" variant="outline">Export CSV</Button>
		</form>
	</header>

	<!-- Filter bar — single form on desktop and mobile. GET so filters are
	     shareable as URLs and the page reload picks them up via URL params. -->
	<Card.Root class="mb-6">
		<Card.Content class="pt-6">
			<form method="GET" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<div class="grid gap-1.5">
					<Label for="actor">Actor</Label>
					<select
						id="actor"
						name="actor"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<option value="">Anyone</option>
						{#each data.actors as a (a.id)}
							<option value={a.id} selected={data.filters.actor === a.id}>
								{a.name} · {a.email}
							</option>
						{/each}
					</select>
				</div>

				<div class="grid gap-1.5">
					<Label for="action">Action</Label>
					<select
						id="action"
						name="action"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<option value="">All actions</option>
						{#each data.actions as a (a)}
							<option value={a} selected={data.filters.action === a}>{a}</option>
						{/each}
					</select>
				</div>

				<div class="grid gap-1.5">
					<Label for="targetType">Target type</Label>
					<select
						id="targetType"
						name="targetType"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<option value="">Any</option>
						{#each data.targetTypes as t (t)}
							<option value={t} selected={data.filters.targetType === t}>{t}</option>
						{/each}
					</select>
				</div>

				<div class="grid gap-1.5">
					<Label for="from">From</Label>
					<Input id="from" name="from" type="date" value={data.filters.from} />
				</div>

				<div class="grid gap-1.5">
					<Label for="to">To</Label>
					<Input id="to" name="to" type="date" value={data.filters.to} />
				</div>

				<div class="flex justify-end gap-2 sm:col-span-2 lg:col-span-5">
					<Button type="submit">Apply filters</Button>
					<Button type="button" variant="ghost" onclick={() => (window.location.href = '?')}>
						Clear
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	{#if entries.length === 0}
		<Card.Root>
			<Card.Content class="py-16 text-center">
				<p class="text-sm text-muted-foreground">No audit entries match the current filters.</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- Desktop table -->
		<div class="hidden md:block">
			<Card.Root>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-muted/50">
							<tr class="border-b">
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">When</th>
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Target</th>
								<th class="px-4 py-3 text-right font-medium text-muted-foreground">Details</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{#each entries as row (row.id)}
								{@const href = targetHref(row.targetType, row.targetId)}
								{@const isOpen = expanded.has(row.id)}
								<tr class="align-top hover:bg-muted/30">
									<td class="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">
										{fmtWhen(row.createdAt)}
									</td>
									<td class="px-4 py-3">
										{#if row.actor}
											<a
												href="/staff/{row.actor.id}"
												class="font-medium underline-offset-2 hover:underline"
											>
												{row.actor.name}
											</a>
											<div class="text-xs text-muted-foreground">{row.actor.email}</div>
										{:else}
											<span class="text-xs text-muted-foreground italic">System</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										<span
											class="inline-flex rounded-full px-2 py-0.5 font-mono text-xs {chipClass(
												row.action
											)}"
										>
											{row.action}
										</span>
									</td>
									<td class="px-4 py-3">
										<div class="font-medium">{row.targetType}</div>
										<div class="font-mono text-xs text-muted-foreground">
											{#if href}
												<a {href} class="underline-offset-2 hover:underline">{row.targetId}</a>
											{:else}
												{row.targetId}
											{/if}
										</div>
									</td>
									<td class="px-4 py-3 text-right">
										{#if row.beforeJson !== null || row.afterJson !== null}
											<button
												type="button"
												class="text-xs underline-offset-2 hover:underline"
												onclick={() => toggle(row.id)}
												aria-expanded={isOpen}
												aria-controls="audit-details-{row.id}"
											>
												{isOpen ? 'Hide' : 'View'}
											</button>
										{:else}
											<span class="text-xs text-muted-foreground">—</span>
										{/if}
									</td>
								</tr>
								{#if isOpen}
									<tr id="audit-details-{row.id}" class="bg-muted/20">
										<td colspan="5" class="px-4 py-3">
											<div class="grid gap-3 md:grid-cols-2">
												<div>
													<div class="mb-1 text-xs font-medium text-muted-foreground uppercase">
														Before
													</div>
													<pre
														class="max-h-72 overflow-auto rounded border bg-background p-2 text-xs">{row.beforeJson ===
														null
															? '—'
															: JSON.stringify(row.beforeJson, null, 2)}</pre>
												</div>
												<div>
													<div class="mb-1 text-xs font-medium text-muted-foreground uppercase">
														After
													</div>
													<pre
														class="max-h-72 overflow-auto rounded border bg-background p-2 text-xs">{row.afterJson ===
														null
															? '—'
															: JSON.stringify(row.afterJson, null, 2)}</pre>
												</div>
											</div>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			</Card.Root>
		</div>

		<!-- Mobile card list -->
		<div class="grid gap-3 md:hidden">
			{#each entries as row (row.id)}
				{@const href = targetHref(row.targetType, row.targetId)}
				{@const isOpen = expanded.has(row.id)}
				<Card.Root>
					<Card.Content class="space-y-2 pt-4">
						<div class="flex items-start justify-between gap-2">
							<span
								class="inline-flex rounded-full px-2 py-0.5 font-mono text-xs {chipClass(
									row.action
								)}"
							>
								{row.action}
							</span>
							<span class="font-mono text-xs text-muted-foreground">
								{fmtWhen(row.createdAt)}
							</span>
						</div>
						<div class="text-sm">
							{#if row.actor}
								<a href="/staff/{row.actor.id}" class="font-medium">{row.actor.name}</a>
							{:else}
								<span class="text-muted-foreground italic">System</span>
							{/if}
							<span class="text-muted-foreground"> · </span>
							<span class="text-muted-foreground">{row.targetType}</span>
						</div>
						<div class="font-mono text-xs text-muted-foreground">
							{#if href}
								<a {href} class="underline-offset-2 hover:underline">{row.targetId}</a>
							{:else}
								{row.targetId}
							{/if}
						</div>
						{#if row.beforeJson !== null || row.afterJson !== null}
							<button
								type="button"
								class="text-xs underline-offset-2 hover:underline"
								onclick={() => toggle(row.id)}
								aria-expanded={isOpen}
							>
								{isOpen ? 'Hide details' : 'View details'}
							</button>
							{#if isOpen}
								<div class="space-y-2">
									<div>
										<div class="mb-1 text-xs font-medium text-muted-foreground uppercase">
											Before
										</div>
										<pre
											class="max-h-60 overflow-auto rounded border bg-muted/30 p-2 text-xs">{row.beforeJson ===
											null
												? '—'
												: JSON.stringify(row.beforeJson, null, 2)}</pre>
									</div>
									<div>
										<div class="mb-1 text-xs font-medium text-muted-foreground uppercase">
											After
										</div>
										<pre
											class="max-h-60 overflow-auto rounded border bg-muted/30 p-2 text-xs">{row.afterJson ===
											null
												? '—'
												: JSON.stringify(row.afterJson, null, 2)}</pre>
									</div>
								</div>
							{/if}
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		<!-- Pagination -->
		<nav class="mt-6 flex items-center justify-between gap-2">
			{#if data.page > 1}
				<a
					href={pageHref(Math.max(1, data.page - 1))}
					class="text-sm underline-offset-2 hover:underline">← Newer</a
				>
			{:else}
				<span></span>
			{/if}
			<span class="text-xs text-muted-foreground">
				Page {data.page} · showing {entries.length} of {data.total.toLocaleString()}
			</span>
			{#if data.hasMore}
				<a href={pageHref(data.page + 1)} class="text-sm underline-offset-2 hover:underline"
					>Older →</a
				>
			{:else}
				<span></span>
			{/if}
		</nav>
	{/if}
</div>
