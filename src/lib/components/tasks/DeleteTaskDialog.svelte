<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';

	// FR-TASK-9 — Delete is soft and admin-only; admin can restore later
	// via /tasks?filter=trash. Confirmation lives in a Dialog (the destructive
	// confirm pattern; Sheet is for create/edit flows).

	type Props = {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		taskTitle: string;
	};

	let { open, onOpenChange, taskTitle }: Props = $props();
	let submitting = $state(false);
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete "{taskTitle}"?</Dialog.Title>
			<Dialog.Description>
				The task is hidden from default lists and recoverable from Trash for 30 days, then
				permanently purged.
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/delete"
			use:enhance={() => {
				submitting = true;
				return async ({ result }) => {
					submitting = false;
					if (result.type === 'redirect') {
						toast.success('Task deleted');
						// The action redirects to /tasks — SvelteKit will navigate.
					} else if (result.type === 'failure' || result.type === 'error') {
						toast.error('Could not delete');
					}
				};
			}}
		>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
				<Button type="submit" variant="destructive" disabled={submitting}>
					{submitting ? 'Deleting…' : 'Delete task'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
