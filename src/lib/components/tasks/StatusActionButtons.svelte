<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import type { TaskStatus } from '@prisma/client';
	import { Button } from '$lib/components/ui/button';

	type Props = {
		allowedTransitions: TaskStatus[];
	};

	let { allowedTransitions }: Props = $props();

	const LABEL: Record<TaskStatus, string> = {
		assigned: 'Move to assigned',
		in_progress: 'Start',
		submitted: 'Submit',
		completed: 'Complete',
		blocked: 'Block',
		cancelled: 'Cancel'
	};

	const VARIANT: Record<TaskStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		assigned: 'outline',
		in_progress: 'default',
		submitted: 'default',
		completed: 'default',
		blocked: 'secondary',
		cancelled: 'destructive'
	};

	let pending = $state(false);
</script>

{#if allowedTransitions.length > 0}
	<div class="flex flex-wrap gap-2">
		{#each allowedTransitions as to (to)}
			<form
				method="POST"
				action="?/updateStatus"
				use:enhance={() => {
					pending = true;
					return async ({ result, update }) => {
						await update({ reset: false });
						pending = false;
						if (result.type === 'success') {
							toast.success(`Status → ${to.replace('_', ' ')}`);
						} else if (result.type === 'failure' || result.type === 'error') {
							toast.error('Could not update status');
						}
					};
				}}
			>
				<input type="hidden" name="to" value={to} />
				<Button type="submit" variant={VARIANT[to]} disabled={pending}>
					{LABEL[to]}
				</Button>
			</form>
		{/each}
	</div>
{/if}
