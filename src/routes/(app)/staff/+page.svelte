<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import InviteSheet from '$lib/components/staff/InviteSheet.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const inviteOpen = $derived(data.canInvite && page.url.searchParams.get('action') === 'invite');

	function initials(name: string, email: string): string {
		return (name || email)
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('');
	}

	function fmtLastSeen(dt: Date | string | null): string {
		if (!dt) return 'Never';
		const d = typeof dt === 'string' ? new Date(dt) : dt;
		const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
		if (days < 1) return 'Today';
		if (days < 2) return 'Yesterday';
		if (days < 30) return `${days}d ago`;
		return d.toLocaleDateString();
	}

	// goto() calls here pass a URL derived from page.url — we're updating
	// search params on the current route, not navigating elsewhere — so the
	// type-safe-routing lint rule doesn't add value. Suppress per-call site.
	function openInvite() {
		const url = new URL(page.url);
		url.searchParams.set('action', 'invite');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: false, noScroll: true });
	}

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

	function gotoPage(p: number) {
		const url = new URL(page.url);
		url.searchParams.set('page', String(p));
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url);
	}
</script>

<svelte:head><title>Staff · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6 md:py-10">
	<header class="mb-4 flex items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">Staff</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.pagination.total}
				{data.pagination.total === 1 ? 'person' : 'people'}
			</p>
		</div>
		{#if data.canInvite}
			<Button onclick={openInvite}>
				<PlusIcon class="size-4" />
				<span class="hidden sm:inline">Invite</span>
			</Button>
		{/if}
	</header>

	<div class="mb-4 flex flex-wrap items-center gap-2">
		<form onsubmit={onSearch} class="relative flex-1 sm:max-w-xs">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				name="q"
				placeholder="Search name or email"
				value={data.filters.q ?? ''}
				class="pl-8"
			/>
		</form>

		<select
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
			value={data.filters.role ?? ''}
			onchange={(e) => applyFilter('role', (e.currentTarget as HTMLSelectElement).value)}
		>
			<option value="">All roles</option>
			<option value="admin">Admin</option>
			<option value="manager">Manager</option>
			<option value="staff">Staff</option>
		</select>

		<select
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
			value={data.filters.department ?? ''}
			onchange={(e) => applyFilter('department', (e.currentTarget as HTMLSelectElement).value)}
		>
			<option value="">All departments</option>
			<option value="none">— Unassigned —</option>
			{#each data.departments as d (d.id)}
				<option value={d.id}>{d.name}</option>
			{/each}
		</select>

		<select
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
			value={data.filters.status ?? ''}
			onchange={(e) => applyFilter('status', (e.currentTarget as HTMLSelectElement).value)}
		>
			<option value="">All</option>
			<option value="active">Active</option>
			<option value="deactivated">Deactivated</option>
		</select>
	</div>

	{#if data.users.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">No one matches those filters.</p>
		</div>
	{:else}
		<!-- Mobile: card list -->
		<ul class="divide-y rounded-lg border md:hidden">
			{#each data.users as u (u.id)}
				<li>
					<a
						href={`/staff/${u.id}`}
						class="flex items-center gap-3 px-4 py-3 hover:bg-accent"
						class:opacity-60={!u.isActive}
					>
						<Avatar class="size-10">
							{#if u.photoUrl}<AvatarImage src={u.photoUrl} alt="" />{/if}
							<AvatarFallback>{initials(u.name, u.email)}</AvatarFallback>
						</Avatar>
						<div class="min-w-0 flex-1">
							<div class="truncate font-medium">{u.name}</div>
							<div class="truncate text-xs text-muted-foreground">{u.email}</div>
						</div>
						<div class="flex flex-col items-end gap-1 text-xs">
							<span class="rounded-full bg-muted px-2 py-0.5 capitalize">{u.role}</span>
							{#if !u.isActive}
								<span class="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive"
									>Deactivated</span
								>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>

		<!-- Desktop: table -->
		<div class="hidden overflow-hidden rounded-lg border md:block">
			<table class="w-full text-sm">
				<thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
					<tr>
						<th class="px-4 py-2.5">Name</th>
						<th class="px-4 py-2.5">Role</th>
						<th class="px-4 py-2.5">Department</th>
						<th class="px-4 py-2.5">Status</th>
						<th class="px-4 py-2.5">Last sign-in</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each data.users as u (u.id)}
						<tr class:opacity-60={!u.isActive}>
							<td class="px-4 py-2.5">
								<a
									href={`/staff/${u.id}`}
									class="flex items-center gap-3 font-medium hover:underline"
								>
									<Avatar class="size-8">
										{#if u.photoUrl}<AvatarImage src={u.photoUrl} alt="" />{/if}
										<AvatarFallback class="text-xs">{initials(u.name, u.email)}</AvatarFallback>
									</Avatar>
									<div>
										<div>{u.name}</div>
										<div class="text-xs font-normal text-muted-foreground">{u.email}</div>
									</div>
								</a>
							</td>
							<td class="px-4 py-2.5 capitalize">{u.role}</td>
							<td class="px-4 py-2.5">{u.department?.name ?? '—'}</td>
							<td class="px-4 py-2.5">
								{#if u.isActive}
									<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700"
										>Active</span
									>
								{:else}
									<span class="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
										>Deactivated</span
									>
								{/if}
							</td>
							<td class="px-4 py-2.5 text-muted-foreground">{fmtLastSeen(u.lastSignInAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

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
	{/if}
</div>

{#if data.canInvite}
	<InviteSheet open={inviteOpen} departments={data.departments} />
{/if}
