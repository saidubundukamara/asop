<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Create form state
	let showCreate = $state(false);
	let createName = $state('');
	let createError = $state('');
	let creating = $state(false);

	// Edit state — only one row editable at a time
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editError = $state('');
	let saving = $state(false);

	// Delete confirm state
	let deletingId = $state<string | null>(null);
	let deleting = $state(false);

	function startEdit(id: string, currentName: string) {
		editingId = id;
		editName = currentName;
		editError = '';
		deletingId = null;
	}

	function cancelEdit() {
		editingId = null;
		editName = '';
		editError = '';
	}

	function startDelete(id: string) {
		deletingId = id;
		editingId = null;
	}

	function cancelDelete() {
		deletingId = null;
	}

	const deptById = $derived(new Map(data.departments.map((d) => [d.id, d])));
</script>

<svelte:head><title>Departments · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-10">
	<header class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">Departments</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.departments.length}
				{data.departments.length === 1 ? 'department' : 'departments'}
			</p>
		</div>
		{#if !showCreate}
			<Button onclick={() => (showCreate = true)}>
				<PlusIcon class="size-4" />
				New department
			</Button>
		{/if}
	</header>

	<!-- Create form -->
	{#if showCreate}
		<Card.Root class="mb-6">
			<Card.Header>
				<Card.Title class="text-base">New department</Card.Title>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/create"
					use:enhance={() => {
						creating = true;
						createError = '';
						return async ({ result, update }) => {
							creating = false;
							if (result.type === 'success' || result.type === 'failure') {
								const data = result.data as { ok: boolean; issues?: Record<string, string[]> };
								if (data?.ok) {
									toast.success('Department created');
									createName = '';
									showCreate = false;
									await invalidateAll();
								} else {
									createError = data?.issues?.name?.[0] ?? 'Something went wrong';
								}
							} else {
								await update();
							}
						};
					}}
					class="flex flex-col gap-4 sm:flex-row sm:items-end"
				>
					<div class="flex-1 space-y-1.5">
						<Label for="create-name">Name</Label>
						<Input
							id="create-name"
							name="name"
							bind:value={createName}
							placeholder="e.g. Engineering"
							maxlength={100}
							required
							autofocus
							aria-invalid={createError ? 'true' : undefined}
							aria-describedby={createError ? 'create-name-error' : undefined}
						/>
						{#if createError}
							<p id="create-name-error" class="text-sm text-destructive">{createError}</p>
						{/if}
					</div>
					<div class="flex gap-2">
						<Button type="submit" disabled={creating}>
							{creating ? 'Creating…' : 'Create'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onclick={() => {
								showCreate = false;
								createName = '';
								createError = '';
							}}
						>
							Cancel
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Department list -->
	{#if data.departments.length === 0}
		<div class="rounded-lg border border-dashed p-10 text-center">
			<p class="text-sm text-muted-foreground">
				No departments yet. Create one to start organising your staff.
			</p>
		</div>
	{:else}
		<Card.Root>
			<ul class="divide-y">
				{#each data.departments as dept (dept.id)}
					{@const isEditing = editingId === dept.id}
					{@const isDeleting = deletingId === dept.id}
					<li class="px-4 py-3">
						{#if isEditing}
							<!-- Edit row -->
							<form
								method="POST"
								action="?/update"
								use:enhance={() => {
									saving = true;
									editError = '';
									return async ({ result }) => {
										saving = false;
										if (result.type === 'success' || result.type === 'failure') {
											const d = result.data as { ok: boolean; issues?: Record<string, string[]> };
											if (d?.ok) {
												toast.success('Department renamed');
												cancelEdit();
												await invalidateAll();
											} else {
												editError = d?.issues?.name?.[0] ?? 'Something went wrong';
											}
										}
									};
								}}
								class="flex flex-col gap-2 sm:flex-row sm:items-center"
							>
								<input type="hidden" name="id" value={dept.id} />
								<div class="flex-1 space-y-1">
									<Input
										name="name"
										bind:value={editName}
										maxlength={100}
										required
										autofocus
										aria-label="Department name"
										aria-invalid={editError ? 'true' : undefined}
									/>
									{#if editError}
										<p class="text-sm text-destructive">{editError}</p>
									{/if}
								</div>
								<div class="flex items-center gap-1.5">
									<Button type="submit" size="sm" disabled={saving}>
										<CheckIcon class="size-3.5" />
										Save
									</Button>
									<Button type="button" size="sm" variant="ghost" onclick={cancelEdit}>
										<XIcon class="size-3.5" />
										Cancel
									</Button>
								</div>
							</form>
						{:else if isDeleting}
							<!-- Delete confirm row -->
							{@const userCount = dept._count.users}
							<div class="space-y-3">
								<div>
									<p class="text-sm font-medium">Delete "{dept.name}"?</p>
									{#if userCount > 0}
										<p class="mt-0.5 text-sm text-muted-foreground">
											{userCount}
											{userCount === 1 ? 'staff member' : 'staff members'} will lose their department
											assignment.
										</p>
									{:else}
										<p class="mt-0.5 text-sm text-muted-foreground">
											This department has no members.
										</p>
									{/if}
								</div>
								<div class="flex gap-2">
									<form
										method="POST"
										action="?/delete"
										use:enhance={() => {
											deleting = true;
											return async ({ result }) => {
												deleting = false;
												if (result.type === 'success' || result.type === 'failure') {
													const d = result.data as { ok: boolean };
													if (d?.ok) {
														toast.success('Department deleted');
														deletingId = null;
														await invalidateAll();
													} else {
														toast.error('Could not delete department');
														deletingId = null;
													}
												}
											};
										}}
									>
										<input type="hidden" name="id" value={dept.id} />
										<Button type="submit" variant="destructive" size="sm" disabled={deleting}>
											{deleting ? 'Deleting…' : 'Yes, delete'}
										</Button>
									</form>
									<Button type="button" size="sm" variant="ghost" onclick={cancelDelete}>
										Cancel
									</Button>
								</div>
							</div>
						{:else}
							<!-- Normal row -->
							<div class="flex items-center gap-3">
								<div class="min-w-0 flex-1">
									<p class="font-medium">{dept.name}</p>
									<p class="text-xs text-muted-foreground">
										{dept._count.users}
										{dept._count.users === 1 ? 'member' : 'members'}
									</p>
								</div>
								<div class="flex shrink-0 items-center gap-1">
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onclick={() => startEdit(dept.id, dept.name)}
										aria-label="Edit {dept.name}"
									>
										<PencilIcon class="size-3.5" />
										<span class="hidden sm:inline">Edit</span>
									</Button>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										class="text-destructive hover:text-destructive"
										onclick={() => startDelete(dept.id)}
										aria-label="Delete {dept.name}"
									>
										<Trash2Icon class="size-3.5" />
										<span class="hidden sm:inline">Delete</span>
									</Button>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</Card.Root>
	{/if}
</div>
