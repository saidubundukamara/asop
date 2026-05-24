<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import type { Component } from 'svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import FileDropzone from '$lib/components/forms/FileDropzone.svelte';

	type Template = {
		id: string;
		name: string;
		defaultPriority: 'low' | 'medium' | 'high';
		defaultDepartmentId: string | null;
		dueDateOffsetDays: number | null;
	};
	type Assignee = { id: string; name: string };
	type Department = { id: string; name: string };
	type Prefill = {
		id: string;
		name: string;
		defaultDescription: string | null;
		defaultPriority: 'low' | 'medium' | 'high';
		defaultDepartmentId: string | null;
		dueDateOffsetDays: number | null;
	};

	type Props = {
		open: boolean;
		templates: Template[];
		assignees: Assignee[];
		departments: Department[];
		prefill: Prefill | null;
	};

	let { open, templates, assignees, departments, prefill }: Props = $props();

	let submitting = $state(false);
	let issues = $state<Record<string, string[]> | null>(null);
	let description = $state('');
	let priority = $state<'low' | 'medium' | 'high'>('medium');
	let departmentId = $state('');
	let dueDate = $state('');
	let dropzoneRef: FileDropzone | undefined = $state();

	// Re-seed every editable field when the template identity changes — the
	// user picked a different template from the dropdown and the parent
	// re-loaded with a new `prefill`. We deliberately clobber in-flight edits
	// here because switching templates is a hard reset of intent.
	$effect.pre(() => {
		void prefill?.id;
		description = prefill?.defaultDescription ?? '';
		priority = prefill?.defaultPriority ?? 'medium';
		departmentId = prefill?.defaultDepartmentId ?? '';
		dueDate = initialDueDate();
	});

	// Lazy-loaded so the ~50KB tiptap chunk only enters the bundle once the
	// sheet opens (PRD § 9.2 initial-JS budget).
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

	function initialDueDate(): string {
		if (!prefill?.dueDateOffsetDays && prefill?.dueDateOffsetDays !== 0) return '';
		// Plain Date used as a one-shot string formatter, never stored as state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const d = new Date();
		d.setDate(d.getDate() + prefill.dueDateOffsetDays);
		return d.toISOString().slice(0, 10);
	}

	function close() {
		const url = new URL(page.url);
		url.searchParams.delete('action');
		url.searchParams.delete('templateId');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: true, noScroll: true });
	}

	function onTemplateChange(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		const url = new URL(page.url);
		url.searchParams.set('action', 'create');
		if (id) url.searchParams.set('templateId', id);
		else url.searchParams.delete('templateId');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: true });
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
			<Sheet.Title>New task</Sheet.Title>
			<Sheet.Description>Assign work to a staff member.</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action="/tasks/new?/create"
			use:enhance={() => {
				submitting = true;
				issues = null;
				return async ({ result }) => {
					submitting = false;
					if (result.type === 'success') {
						const data = result.data as { data?: { id?: string } } | undefined;
						const taskId = data?.data?.id;
						toast.success('Task created');
						close();
						if (taskId) {
							// Flush any queued attachments before navigating so they land on the task.
							if (dropzoneRef) void dropzoneRef.flush(taskId).catch(() => {});
							// eslint-disable-next-line svelte/no-navigation-without-resolve
							void goto(`/tasks/${taskId}`);
						}
					} else if (result.type === 'failure') {
						const fail = result.data as { issues?: Record<string, string[]> } | undefined;
						issues = fail?.issues ?? null;
						toast.error(Object.values(fail?.issues ?? {})[0]?.[0] ?? 'Could not create task');
					}
				};
			}}
			class="grid gap-4 px-4 py-2"
		>
			<div class="grid gap-1.5">
				<Label for="task-template">Start from template</Label>
				<select
					id="task-template"
					value={prefill?.id ?? ''}
					onchange={onTemplateChange}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<option value="">— none —</option>
					{#each templates as tpl (tpl.id)}
						<option value={tpl.id}>{tpl.name}</option>
					{/each}
				</select>
				{#if prefill}
					<input type="hidden" name="templateId" value={prefill.id} />
				{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="task-title">Title</Label>
				<Input id="task-title" name="title" required maxlength={140} autocomplete="off" />
				{#if issues?.title}<p class="text-xs text-destructive">{issues.title[0]}</p>{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="task-description">Description</Label>
				<input type="hidden" name="description" value={description} />
				{#if EditorComponent}
					{@const Editor = EditorComponent}
					<Editor
						value={description}
						onChange={(html) => (description = html)}
						placeholder="Add detail…"
						ariaLabel="Task description"
					/>
				{:else}
					<div
						class="min-h-[140px] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
					>
						Loading editor…
					</div>
				{/if}
				{#if issues?.description}
					<p class="text-xs text-destructive">{issues.description[0]}</p>
				{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="task-assignee">Assignee</Label>
				<select
					id="task-assignee"
					name="assigneeId"
					required
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<option value="">Pick a person</option>
					{#each assignees as u (u.id)}
						<option value={u.id}>{u.name}</option>
					{/each}
				</select>
				{#if issues?.assigneeId}
					<p class="text-xs text-destructive">{issues.assigneeId[0]}</p>
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label for="task-due">Due date</Label>
					<Input id="task-due" name="dueDate" type="date" bind:value={dueDate} />
					{#if issues?.dueDate}<p class="text-xs text-destructive">{issues.dueDate[0]}</p>{/if}
				</div>
				<div class="grid gap-1.5">
					<Label for="task-priority">Priority</Label>
					<select
						id="task-priority"
						name="priority"
						bind:value={priority}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
					</select>
				</div>
			</div>

			<div class="grid gap-1.5">
				<Label for="task-program">Program</Label>
				<select
					id="task-program"
					name="departmentId"
					bind:value={departmentId}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<option value="">— inherit from assignee —</option>
					{#each departments as d (d.id)}
						<option value={d.id}>{d.name}</option>
					{/each}
				</select>
			</div>

			<div class="grid gap-1.5">
				<span class="text-sm font-medium">Attachments</span>
				<FileDropzone
					bind:this={dropzoneRef}
					ownerType="task"
					ownerId={null}
					folder="task-attachments"
				/>
			</div>

			<Sheet.Footer>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Creating…' : 'Create task'}
				</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
