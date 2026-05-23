<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import type { Component } from 'svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';

	// Shared sheet used by /templates/tasks (create) and /templates/tasks/[id]
	// (update). Differences are the form action target and the initial values.

	type Department = { id: string; name: string };
	type Template = {
		id: string;
		name: string;
		defaultDescription: string | null;
		defaultPriority: 'low' | 'medium' | 'high';
		defaultDepartmentId: string | null;
		dueDateOffsetDays: number | null;
	} | null;

	type Props = {
		open: boolean;
		mode: 'create' | 'update';
		departments: Department[];
		template: Template;
		actionPath: string;
	};

	let { open, mode, departments, template, actionPath }: Props = $props();

	let submitting = $state(false);
	let issues = $state<Record<string, string[]> | null>(null);
	// Seed once; don't auto-clobber mid-edit.
	let description = $state(untrack(() => template?.defaultDescription ?? ''));

	let EditorComponent = $state<Component<{
		value: string;
		onChange: (html: string) => void;
		placeholder?: string;
		ariaLabel: string;
	}> | null>(null);

	$effect(() => {
		if (open && !EditorComponent) {
			void import('$lib/components/forms/RichTextEditor.svelte').then((m) => {
				EditorComponent = m.default;
			});
		}
	});

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
	<Sheet.Content side="right" class="w-full max-w-md overflow-y-auto">
		<Sheet.Header>
			<Sheet.Title>{mode === 'create' ? 'New task template' : 'Edit task template'}</Sheet.Title>
			<Sheet.Description>Templates let admins repeat common task shapes.</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action={actionPath}
			use:enhance={() => {
				submitting = true;
				issues = null;
				return async ({ result, update }) => {
					await update({ reset: mode === 'create' });
					submitting = false;
					if (result.type === 'success') {
						toast.success(mode === 'create' ? 'Template created' : 'Template updated');
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
			<div class="grid gap-1.5">
				<Label for="tpl-name">Name</Label>
				<Input
					id="tpl-name"
					name="name"
					required
					maxlength={120}
					value={template?.name ?? ''}
					autocomplete="off"
				/>
				{#if issues?.name}<p class="text-xs text-destructive">{issues.name[0]}</p>{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="tpl-description">Default description</Label>
				<input type="hidden" name="defaultDescription" value={description} />
				{#if EditorComponent}
					{@const Editor = EditorComponent}
					<Editor
						value={description}
						onChange={(html) => (description = html)}
						placeholder="Optional default body…"
						ariaLabel="Default description"
					/>
				{:else}
					<div
						class="min-h-[140px] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
					>
						Loading editor…
					</div>
				{/if}
				{#if issues?.defaultDescription}
					<p class="text-xs text-destructive">{issues.defaultDescription[0]}</p>
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label for="tpl-priority">Default priority</Label>
					<select
						id="tpl-priority"
						name="defaultPriority"
						value={template?.defaultPriority ?? 'medium'}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
					</select>
				</div>
				<div class="grid gap-1.5">
					<Label for="tpl-offset">Due offset (days)</Label>
					<Input
						id="tpl-offset"
						name="dueDateOffsetDays"
						type="number"
						min="0"
						max="365"
						value={template?.dueDateOffsetDays ?? ''}
						placeholder="e.g. 3"
					/>
					{#if issues?.dueDateOffsetDays}
						<p class="text-xs text-destructive">{issues.dueDateOffsetDays[0]}</p>
					{/if}
				</div>
			</div>

			<div class="grid gap-1.5">
				<Label for="tpl-program">Default program</Label>
				<select
					id="tpl-program"
					name="defaultDepartmentId"
					value={template?.defaultDepartmentId ?? ''}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<option value="">— none —</option>
					{#each departments as d (d.id)}
						<option value={d.id}>{d.name}</option>
					{/each}
				</select>
			</div>

			<Sheet.Footer>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Saving…' : mode === 'create' ? 'Create template' : 'Save changes'}
				</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
