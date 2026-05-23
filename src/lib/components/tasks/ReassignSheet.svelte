<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';

	type Assignee = { id: string; name: string };

	type Props = {
		open: boolean;
		currentAssigneeId: string;
		assignees: Assignee[];
	};

	let { open, currentAssigneeId, assignees }: Props = $props();
	let submitting = $state(false);
	let issues = $state<Record<string, string[]> | null>(null);

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
	<Sheet.Content side="right" class="w-full max-w-md">
		<Sheet.Header>
			<Sheet.Title>Reassign task</Sheet.Title>
			<Sheet.Description>The new assignee sees this task immediately.</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action="?/reassign"
			use:enhance={() => {
				submitting = true;
				issues = null;
				return async ({ result, update }) => {
					await update({ reset: false });
					submitting = false;
					if (result.type === 'success') {
						toast.success('Task reassigned');
						close();
					} else if (result.type === 'failure') {
						const fail = result.data as { issues?: Record<string, string[]> } | undefined;
						issues = fail?.issues ?? null;
						toast.error(Object.values(fail?.issues ?? {})[0]?.[0] ?? 'Could not reassign');
					}
				};
			}}
			class="grid gap-4 px-4 py-2"
		>
			<div class="grid gap-1.5">
				<Label for="reassign-to">New assignee</Label>
				<select
					id="reassign-to"
					name="assigneeId"
					required
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<option value="">Pick a person</option>
					{#each assignees as u (u.id)}
						{#if u.id !== currentAssigneeId}
							<option value={u.id}>{u.name}</option>
						{/if}
					{/each}
				</select>
				{#if issues?.assigneeId}
					<p class="text-xs text-destructive">{issues.assigneeId[0]}</p>
				{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="reassign-reason">Reason (optional)</Label>
				<Input id="reassign-reason" name="reason" maxlength={500} placeholder="Why the change?" />
			</div>

			<Sheet.Footer>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Reassigning…' : 'Reassign'}
				</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
