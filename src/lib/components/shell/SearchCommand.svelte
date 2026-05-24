<script lang="ts">
	import { onMount, tick } from 'svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { SearchResults } from '$lib/server/db/search';

	// FR-SEARCH-1 — global Cmd/K palette. Owns query/debounce/fetch and renders
	// grouped results. RBAC is enforced server-side in /api/search; this UI
	// just renders what comes back.

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let q = $state('');
	let results = $state<SearchResults | null>(null);
	let loading = $state(false);
	let activeIndex = $state(0);
	let inputEl: HTMLInputElement | null = $state(null);
	let listEl: HTMLDivElement | null = $state(null);
	let abortCtrl: AbortController | null = null;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Flat list of results for keyboard nav. Recomputed when results change.
	type FlatHit = { href: string; title: string; subtitle: string; group: string };
	const flatHits = $derived(flatten(results));

	function flatten(r: SearchResults | null): FlatHit[] {
		if (!r) return [];
		const out: FlatHit[] = [];
		for (const s of r.staff)
			out.push({ href: s.href, title: s.name, subtitle: s.email, group: 'Staff' });
		for (const t of r.tasks)
			out.push({ href: t.href, title: t.title, subtitle: t.snippet, group: 'Tasks' });
		for (const rep of r.reports)
			out.push({ href: rep.href, title: rep.label, subtitle: rep.snippet, group: 'Reports' });
		for (const c of r.taskComments)
			out.push({ href: c.href, title: c.taskTitle, subtitle: c.snippet, group: 'Task comments' });
		for (const c of r.reportComments)
			out.push({
				href: c.href,
				title: c.reportLabel,
				subtitle: c.snippet,
				group: 'Report comments'
			});
		return out;
	}

	function runSearch(query: string) {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			const trimmed = query.trim();
			if (trimmed.length < 2) {
				results = null;
				loading = false;
				return;
			}
			abortCtrl?.abort();
			abortCtrl = new AbortController();
			loading = true;
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
					signal: abortCtrl.signal
				});
				if (res.ok) {
					results = (await res.json()) as SearchResults;
					activeIndex = 0;
				}
			} catch (err) {
				if ((err as Error).name !== 'AbortError') results = null;
			} finally {
				loading = false;
			}
		}, 150);
	}

	$effect(() => {
		runSearch(q);
	});

	$effect(() => {
		if (open) {
			tick().then(() => inputEl?.focus());
		} else {
			// Reset on close so reopening starts fresh.
			q = '';
			results = null;
			activeIndex = 0;
		}
	});

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (flatHits.length > 0) activeIndex = (activeIndex + 1) % flatHits.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (flatHits.length > 0) activeIndex = (activeIndex - 1 + flatHits.length) % flatHits.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			// Delegate to the active anchor's native click so SvelteKit's
			// link-click interception handles navigation. Avoids goto() — the
			// linter wants resolve() on goto() and resolve() can't type-check
			// dynamic, server-returned paths.
			const link = listEl?.querySelector<HTMLAnchorElement>(
				`a[data-search-index="${activeIndex}"]`
			);
			link?.click();
		}
	}

	// Cmd/Ctrl + K global listener. Suppressed if focus is in an input/textarea
	// elsewhere so we don't hijack form typing.
	onMount(() => {
		function onKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				const t = e.target as HTMLElement | null;
				const inField =
					t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
				if (inField && !open) return;
				e.preventDefault();
				open = !open;
			}
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	// Index offset per group so the highlight ring tracks across all rows.
	function flatIndex(group: string, indexInGroup: number): number {
		if (!results) return -1;
		let base = 0;
		const order: Array<{ name: string; len: number }> = [
			{ name: 'Staff', len: results.staff.length },
			{ name: 'Tasks', len: results.tasks.length },
			{ name: 'Reports', len: results.reports.length },
			{ name: 'Task comments', len: results.taskComments.length },
			{ name: 'Report comments', len: results.reportComments.length }
		];
		for (const g of order) {
			if (g.name === group) return base + indexInGroup;
			base += g.len;
		}
		return -1;
	}

	function seeAllHref(group: string, query: string): string {
		const qp = `?q=${encodeURIComponent(query)}`;
		if (group === 'Staff') return `/staff${qp}`;
		if (group === 'Tasks' || group === 'Task comments') return `/tasks${qp}`;
		return `/reports${qp}`;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="top-[10%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl">
		<Dialog.Header class="sr-only">
			<Dialog.Title>Search</Dialog.Title>
			<Dialog.Description>Search across staff, tasks, reports, and comments.</Dialog.Description>
		</Dialog.Header>
		<div class="flex items-center gap-2 border-b px-4 py-3">
			<SearchIcon class="size-4 shrink-0 text-muted-foreground" />
			<input
				bind:this={inputEl}
				bind:value={q}
				onkeydown={handleKey}
				type="search"
				placeholder="Search staff, tasks, reports…"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
			/>
			<kbd
				class="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-block"
				>ESC</kbd
			>
		</div>

		<div bind:this={listEl} class="max-h-[60vh] overflow-y-auto">
			{#if loading && !results}
				<div class="p-6 text-center text-sm text-muted-foreground">Searching…</div>
			{:else if q.trim().length < 2}
				<div class="p-6 text-center text-sm text-muted-foreground">Type at least 2 characters.</div>
			{:else if results && flatHits.length === 0}
				<div class="p-6 text-center text-sm text-muted-foreground">No results for "{q}".</div>
			{:else if results}
				{#each [{ name: 'Staff', items: results.staff.map( (h) => ({ href: h.href, title: h.name, subtitle: h.email }) ) }, { name: 'Tasks', items: results.tasks.map( (h) => ({ href: h.href, title: h.title, subtitle: h.snippet }) ) }, { name: 'Reports', items: results.reports.map( (h) => ({ href: h.href, title: h.label, subtitle: h.snippet }) ) }, { name: 'Task comments', items: results.taskComments.map( (h) => ({ href: h.href, title: h.taskTitle, subtitle: h.snippet }) ) }, { name: 'Report comments', items: results.reportComments.map( (h) => ({ href: h.href, title: h.reportLabel, subtitle: h.snippet }) ) }] as group (group.name)}
					{#if group.items.length > 0}
						<div class="border-b last:border-b-0">
							<div class="flex items-center justify-between px-4 pt-3 pb-1">
								<div
									class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
								>
									{group.name}
								</div>
								<a
									href={seeAllHref(group.name, q)}
									onclick={() => (open = false)}
									class="text-xs text-muted-foreground hover:text-foreground"
								>
									See all →
								</a>
							</div>
							<ul>
								{#each group.items as item, i (item.href + i)}
									{@const idx = flatIndex(group.name, i)}
									<li>
										<a
											href={item.href}
											data-search-index={idx}
											onclick={() => (open = false)}
											onmouseenter={() => (activeIndex = idx)}
											class={`block w-full px-4 py-2 text-left transition-colors ${idx === activeIndex ? 'bg-muted' : ''}`}
										>
											<div class="truncate text-sm font-medium">{item.title}</div>
											{#if item.subtitle}
												<!-- ts_headline returns safe-by-construction HTML (no script tags possible);
												     no DB content here other than the snippet itself. Render as text to be safe. -->
												<div class="truncate text-xs text-muted-foreground">{item.subtitle}</div>
											{/if}
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/each}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
