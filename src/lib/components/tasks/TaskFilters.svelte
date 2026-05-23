<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Input } from '$lib/components/ui/input';

	type Department = { id: string; name: string };
	type TeamUser = { id: string; name: string };

	type Props = {
		filters: {
			status: string | null;
			priority: string | null;
			program: string | null;
			assigneeId: string | null;
			due: string | null;
			sort: string;
			q: string;
		};
		departments: Department[];
		teamUsers: TeamUser[];
		view: 'my' | 'team' | 'all';
		isTrash: boolean;
		canSeeTrash: boolean;
		showAllOption: boolean;
	};

	let { filters, departments, teamUsers, view, isTrash, canSeeTrash, showAllOption }: Props =
		$props();

	function applyFilter(name: string, value: string) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(name, value);
		else url.searchParams.delete(name);
		url.searchParams.delete('page');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { keepFocus: true });
	}

	function onSearch(e: SubmitEvent) {
		e.preventDefault();
		const form = e.currentTarget as HTMLFormElement;
		const q = String(new FormData(form).get('q') ?? '').trim();
		applyFilter('q', q);
	}

	function switchView(v: 'my' | 'team' | 'all') {
		const url = new URL(page.url);
		url.searchParams.set('view', v);
		url.searchParams.delete('page');
		url.searchParams.delete('filter');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url);
	}

	function toggleTrash() {
		const url = new URL(page.url);
		if (isTrash) url.searchParams.delete('filter');
		else url.searchParams.set('filter', 'trash');
		url.searchParams.delete('page');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url);
	}

	function tabClass(active: boolean) {
		return [
			'rounded-md px-3 py-1.5 text-sm transition',
			active
				? 'bg-foreground text-background'
				: 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
		].join(' ');
	}
</script>

<div class="mb-4 flex flex-wrap items-center gap-2">
	<div class="flex items-center gap-1 rounded-md bg-muted p-1">
		<button
			type="button"
			class={tabClass(view === 'my' && !isTrash)}
			onclick={() => switchView('my')}
		>
			My
		</button>
		<button
			type="button"
			class={tabClass(view === 'team' && !isTrash)}
			onclick={() => switchView('team')}
		>
			Team
		</button>
		{#if showAllOption}
			<button
				type="button"
				class={tabClass(view === 'all' && !isTrash)}
				onclick={() => switchView('all')}
			>
				All
			</button>
		{/if}
		{#if canSeeTrash}
			<button type="button" class={tabClass(isTrash)} onclick={toggleTrash}>Trash</button>
		{/if}
	</div>

	<form onsubmit={onSearch} class="relative flex-1 sm:max-w-xs">
		<SearchIcon
			class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<Input
			type="search"
			name="q"
			placeholder="Search title or description"
			value={filters.q ?? ''}
			class="pl-8"
		/>
	</form>

	<select
		class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		value={filters.status ?? ''}
		onchange={(e) => applyFilter('status', (e.currentTarget as HTMLSelectElement).value)}
	>
		<option value="">All statuses</option>
		<option value="assigned">Assigned</option>
		<option value="in_progress">In progress</option>
		<option value="submitted">Submitted</option>
		<option value="completed">Completed</option>
		<option value="blocked">Blocked</option>
		<option value="cancelled">Cancelled</option>
	</select>

	<select
		class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		value={filters.priority ?? ''}
		onchange={(e) => applyFilter('priority', (e.currentTarget as HTMLSelectElement).value)}
	>
		<option value="">All priorities</option>
		<option value="high">High</option>
		<option value="medium">Medium</option>
		<option value="low">Low</option>
	</select>

	<select
		class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		value={filters.due ?? ''}
		onchange={(e) => applyFilter('due', (e.currentTarget as HTMLSelectElement).value)}
	>
		<option value="">Any due date</option>
		<option value="overdue">Overdue</option>
		<option value="today">Due today</option>
		<option value="week">Due this week</option>
	</select>

	{#if departments.length > 0}
		<select
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
			value={filters.program ?? ''}
			onchange={(e) => applyFilter('program', (e.currentTarget as HTMLSelectElement).value)}
		>
			<option value="">All programs</option>
			<option value="none">— Unassigned —</option>
			{#each departments as d (d.id)}
				<option value={d.id}>{d.name}</option>
			{/each}
		</select>
	{/if}

	{#if teamUsers.length > 0 && view !== 'my'}
		<select
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
			value={filters.assigneeId ?? ''}
			onchange={(e) => applyFilter('assigneeId', (e.currentTarget as HTMLSelectElement).value)}
		>
			<option value="">All assignees</option>
			{#each teamUsers as u (u.id)}
				<option value={u.id}>{u.name}</option>
			{/each}
		</select>
	{/if}

	<select
		class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		value={filters.sort}
		onchange={(e) => applyFilter('sort', (e.currentTarget as HTMLSelectElement).value)}
	>
		<option value="due">Sort by due</option>
		<option value="priority">Sort by priority</option>
		<option value="updated">Recently updated</option>
	</select>
</div>
