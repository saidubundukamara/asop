<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import type { Component } from 'svelte';
	import type { TaskPriority } from '@prisma/client';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';

	type Department = { id: string; name: string };
	type Task = {
		title: string;
		description: string | null;
		priority: TaskPriority;
		dueDate: Date | string | null;
		departmentId: string | null;
	};

	type Props = {
		open: boolean;
		task: Task;
		departments: Department[];
	};

	let { open, task, departments }: Props = $props();

	let submitting = $state(false);
	let issues = $state<Record<string, string[]> | null>(null);
	// Seed once from the loaded task; don't auto-clobber if the parent's data
	// refreshes mid-edit (the user might be typing in this very field).
	let description = $state(untrack(() => task.description ?? ''));

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

	function fmtDateInput(d: Date | string | null): string {
		if (!d) return '';
		const dd = typeof d === 'string' ? new Date(d) : d;
		return dd.toISOString().slice(0, 10);
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
			<Sheet.Title>Edit task</Sheet.Title>
		</Sheet.Header>

		<form
			method="POST"
			action="?/updateFields"
			use:enhance={() => {
				submitting = true;
				issues = null;
				return async ({ result, update }) => {
					await update({ reset: false });
					submitting = false;
					if (result.type === 'success') {
						toast.success('Task updated');
						close();
					} else if (result.type === 'failure') {
						const fail = result.data as { issues?: Record<string, string[]> } | undefined;
						issues = fail?.issues ?? null;
						toast.error(Object.values(fail?.issues ?? {})[0]?.[0] ?? 'Could not save changes');
					}
				};
			}}
			class="grid gap-4 px-4 py-2"
		>
			<div class="grid gap-1.5">
				<Label for="edit-task-title">Title</Label>
				<Input
					id="edit-task-title"
					name="title"
					required
					maxlength={140}
					value={task.title}
					autocomplete="off"
				/>
				{#if issues?.title}<p class="text-xs text-destructive">{issues.title[0]}</p>{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="edit-task-description">Description</Label>
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

			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-1.5">
					<Label for="edit-task-due">Due date</Label>
					<Input id="edit-task-due" name="dueDate" type="date" value={fmtDateInput(task.dueDate)} />
					{#if issues?.dueDate}<p class="text-xs text-destructive">{issues.dueDate[0]}</p>{/if}
				</div>
				<div class="grid gap-1.5">
					<Label for="edit-task-priority">Priority</Label>
					<select
						id="edit-task-priority"
						name="priority"
						value={task.priority}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
					</select>
				</div>
			</div>

			{#if departments.length > 0}
				<div class="grid gap-1.5">
					<Label for="edit-task-program">Program</Label>
					<select
						id="edit-task-program"
						name="departmentId"
						value={task.departmentId ?? ''}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<option value="">— none —</option>
						{#each departments as d (d.id)}
							<option value={d.id}>{d.name}</option>
						{/each}
					</select>
				</div>
			{/if}

			<Sheet.Footer>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Saving…' : 'Save changes'}
				</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
