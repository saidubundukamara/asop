<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import EditStaffSheet from '$lib/components/staff/EditStaffSheet.svelte';
	import DeactivateConfirmDialog from '$lib/components/staff/DeactivateConfirmDialog.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const target = $derived(data.target);

	const editOpen = $derived(data.canEdit && page.url.searchParams.get('action') === 'edit');
	let confirmOpen = $state(false);

	const initials = $derived(
		(target.name || target.email)
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('')
	);

	function openEdit() {
		const url = new URL(page.url);
		url.searchParams.set('action', 'edit');
		// URL stays on the same route — we're only flipping the ?action param
		// to drive the edit sheet. The type-safe-routing rule doesn't apply.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: false, noScroll: true });
	}

	function fmtDate(dt: Date | string | null): string {
		if (!dt) return 'Never';
		const d = typeof dt === 'string' ? new Date(dt) : dt;
		return d.toLocaleString();
	}
</script>

<svelte:head><title>{target.name} · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 md:py-10">
	<a
		href="/staff"
		class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ChevronLeftIcon class="size-4" />
		Staff
	</a>

	<header class="mb-6 flex items-start gap-4">
		<Avatar class="size-20">
			{#if target.photoUrl}<AvatarImage src={target.photoUrl} alt="" />{/if}
			<AvatarFallback class="text-xl">{initials}</AvatarFallback>
		</Avatar>
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="text-2xl font-semibold tracking-tight">{target.name}</h1>
				{#if !target.isActive}
					<span class="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
						Deactivated
					</span>
				{/if}
			</div>
			<p class="text-sm text-muted-foreground">{target.email}</p>
			<div class="mt-2 flex flex-wrap gap-2 text-xs">
				<span class="rounded-full bg-muted px-2 py-0.5 capitalize">{target.role}</span>
				<span class="rounded-full bg-muted px-2 py-0.5"
					>{target.department?.name ?? 'No department'}</span
				>
			</div>
		</div>
		{#if data.canEdit}
			<Button variant="outline" size="sm" onclick={openEdit}>
				<PencilIcon class="size-4" />
				Edit
			</Button>
		{/if}
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Details</Card.Title>
		</Card.Header>
		<Card.Content class="grid gap-3 text-sm">
			<div class="flex items-baseline justify-between gap-4">
				<span class="text-muted-foreground">Phone</span>
				<span class="font-medium">{target.phone ?? '—'}</span>
			</div>
			<div class="flex items-baseline justify-between gap-4">
				<span class="text-muted-foreground">Time zone</span>
				<span class="font-medium">{target.timeZone ?? 'UTC'}</span>
			</div>
			<div class="flex items-baseline justify-between gap-4">
				<span class="text-muted-foreground">Last sign-in</span>
				<span class="font-medium">{fmtDate(target.lastSignInAt)}</span>
			</div>
			<div class="flex items-baseline justify-between gap-4">
				<span class="text-muted-foreground">Joined</span>
				<span class="font-medium">{fmtDate(target.createdAt)}</span>
			</div>
		</Card.Content>
	</Card.Root>

	{#if data.canDeactivate && !data.isSelf}
		<div class="mt-6 flex justify-end">
			<Button
				variant={target.isActive ? 'destructive' : 'default'}
				onclick={() => (confirmOpen = true)}
			>
				{target.isActive ? 'Deactivate' : 'Reactivate'}
			</Button>
		</div>
	{/if}
</div>

{#if data.canEdit}
	<EditStaffSheet
		open={editOpen}
		target={{
			name: target.name,
			phone: target.phone,
			role: target.role,
			departmentId: target.departmentId
		}}
		departments={data.departments}
	/>
{/if}

{#if data.canDeactivate && !data.isSelf}
	<DeactivateConfirmDialog
		open={confirmOpen}
		onOpenChange={(o) => (confirmOpen = o)}
		targetName={target.name}
		mode={target.isActive ? 'deactivate' : 'reactivate'}
	/>
{/if}
