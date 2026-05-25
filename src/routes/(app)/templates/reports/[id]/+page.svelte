<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import FieldEditorList from '$lib/components/reports/FieldEditorList.svelte';
	import type { PageData, ActionData } from './$types';
	import { untrack } from 'svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const tpl = $derived(data.tpl);
	// Coerce nullable Prisma fields to the empty strings FieldEditorList expects.
	let fields = $state(
		untrack(() =>
			structuredClone(
				tpl.fields.map((f) => ({
					...f,
					helpText: f.helpText ?? '',
					configJson: f.configJson ? JSON.stringify(f.configJson) : '',
					defaultValue: f.defaultValue ?? ''
				}))
			)
		)
	);
	let name = $state(untrack(() => tpl.name));
	let description = $state(untrack(() => tpl.description ?? ''));
	let departmentId = $state(untrack(() => tpl.department?.id ?? ''));
	let reviewerRole = $state(untrack(() => tpl.reviewerRole as 'manager' | 'admin'));

	let saving = $state(false);

	$effect(() => {
		if (form?.ok) {
			toast.success(
				data.nonDraftCount > 0
					? 'New template version created (existing reports are unaffected)'
					: 'Template saved'
			);
		}
	});
</script>

<svelte:head><title>{tpl.name} · Report templates · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-10">
	<div class="mb-6">
		<a href="/templates/reports" class="text-sm text-muted-foreground hover:underline">
			← Report templates
		</a>
		<h1 class="mt-2 text-2xl font-semibold tracking-tight">{tpl.name}</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			v{tpl.version}
			{#if !tpl.isActive}<span class="ml-1 text-destructive">· inactive</span>{/if}
			{#if data.nonDraftCount > 0}
				<span class="ml-1">
					· {data.nonDraftCount} submitted {data.nonDraftCount === 1 ? 'report' : 'reports'} — editing
					will create v{tpl.version + 1}
				</span>
			{/if}
		</p>
	</div>

	<form
		method="POST"
		action="?/update"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				saving = false;
				await update({ reset: false });
				if (result.type !== 'success') toast.error('Could not save');
			};
		}}
	>
		<input type="hidden" name="id" value={tpl.id} />
		<input type="hidden" name="fieldsJson" value={JSON.stringify(fields)} />

		<div class="space-y-4 rounded-lg border p-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label class="mb-1 block text-sm font-medium" for="name">Name *</label>
					<input
						id="name"
						name="name"
						type="text"
						bind:value={name}
						required
						maxlength="120"
						class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium" for="reviewerRole">Reviewed by</label>
					<select
						id="reviewerRole"
						name="reviewerRole"
						bind:value={reviewerRole}
						class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
					>
						<option value="manager">Manager</option>
						<option value="admin">Admin</option>
					</select>
				</div>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium" for="description">Description</label>
				<textarea
					id="description"
					name="description"
					bind:value={description}
					rows="2"
					class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
				></textarea>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium" for="departmentId">Department</label>
				<select
					id="departmentId"
					name="departmentId"
					bind:value={departmentId}
					class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
				>
					<option value="">All departments</option>
					{#each data.departments as dept (dept.id)}
						<option value={dept.id}>{dept.name}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="mt-6">
			<h2 class="mb-3 text-base font-semibold">Fields</h2>
			<FieldEditorList bind:fields />
		</div>

		<div class="mt-6 flex justify-end gap-2">
			<a href="/templates/reports">
				<Button variant="outline" type="button">Cancel</Button>
			</a>
			<Button type="submit" disabled={saving}>
				{saving ? 'Saving…' : 'Save template'}
			</Button>
		</div>
	</form>
</div>
