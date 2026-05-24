<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import FieldEditorList from './FieldEditorList.svelte';

	// Create-only sheet for /templates/reports.
	// Edit happens inline on /templates/reports/[id].

	type Department = { id: string; name: string };

	let {
		open,
		departments,
		actionPath
	}: {
		open: boolean;
		departments: Department[];
		actionPath: string;
	} = $props();

	let submitting = $state(false);
	let issues = $state<Record<string, string[]> | null>(null);
	let fields = $state<Field[]>([]);

	type Field = {
		label: string;
		fieldType: string;
		helpText: string;
		isRequired: boolean;
		displayOrder: number;
		configJson: string;
		defaultValue: string;
	};

	function close() {
		const url = new URL(page.url);
		url.searchParams.delete('action');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: true, noScroll: true });
	}
</script>

<Sheet.Root
	{open}
	onOpenChange={(o) => {
		if (!o) close();
	}}
>
	<Sheet.Content side="right" class="w-full max-w-lg overflow-y-auto">
		<Sheet.Header>
			<Sheet.Title>New report template</Sheet.Title>
			<Sheet.Description>
				Define a form that staff will fill out when submitting a report.
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={actionPath}
			use:enhance={() => {
				submitting = true;
				issues = null;
				return async ({ result, update }) => {
					await update({ reset: true });
					submitting = false;
					if (result.type === 'success') {
						toast.success('Template created');
						fields = [];
						close();
					} else if (result.type === 'failure') {
						const fail = result.data as { issues?: Record<string, string[]> } | undefined;
						issues = fail?.issues ?? null;
						toast.error(Object.values(fail?.issues ?? {})[0]?.[0] ?? 'Could not save');
					}
				};
			}}
			class="grid gap-4 px-4 py-2"
		>
			<!-- Serialize fields to hidden input -->
			<input type="hidden" name="fieldsJson" value={JSON.stringify(fields)} />

			<div class="grid gap-1.5">
				<Label for="tpl-name">Name *</Label>
				<Input id="tpl-name" name="name" required maxlength={120} autocomplete="off" />
				{#if issues?.name}<p class="text-xs text-destructive">{issues.name[0]}</p>{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="tpl-description">Description</Label>
				<textarea
					id="tpl-description"
					name="description"
					rows="2"
					class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
				></textarea>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label for="tpl-dept">Department</Label>
					<select
						id="tpl-dept"
						name="departmentId"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="">All departments</option>
						{#each departments as d (d.id)}
							<option value={d.id}>{d.name}</option>
						{/each}
					</select>
				</div>
				<div class="grid gap-1.5">
					<Label for="tpl-reviewer">Reviewed by *</Label>
					<select
						id="tpl-reviewer"
						name="reviewerRole"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="manager">Manager</option>
						<option value="admin">Admin</option>
					</select>
				</div>
			</div>

			{#if issues?.fieldsJson}
				<p class="text-xs text-destructive">{issues.fieldsJson[0]}</p>
			{/if}

			<div>
				<h3 class="mb-2 text-sm font-semibold">Fields</h3>
				<FieldEditorList bind:fields />
			</div>

			<Sheet.Footer>
				<Button type="submit" disabled={submitting || fields.length === 0}>
					{submitting ? 'Creating…' : 'Create template'}
				</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
