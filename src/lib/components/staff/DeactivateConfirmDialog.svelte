<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';

	// FR-USER-4 — Deactivation requires confirmation. Existing tasks and
	// reports are preserved; the user remains visible (greyed out) in
	// historical views and cannot sign in.

	type Props = {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		targetName: string;
		mode: 'deactivate' | 'reactivate';
	};

	let { open, onOpenChange, targetName, mode }: Props = $props();
	let submitting = $state(false);
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{mode === 'deactivate' ? 'Deactivate' : 'Reactivate'}
				{targetName}?
			</Dialog.Title>
			<Dialog.Description>
				{#if mode === 'deactivate'}
					They won't be able to sign in. All their existing tasks and reports stay in the system and
					can still be viewed. This is reversible.
				{:else}
					They'll regain access on their next sign-in attempt.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action={mode === 'deactivate' ? '?/deactivate' : '?/reactivate'}
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					await update();
					submitting = false;
					if (result.type === 'success') {
						toast.success(
							mode === 'deactivate' ? `${targetName} deactivated` : `${targetName} reactivated`
						);
						await invalidateAll();
						onOpenChange(false);
					} else if (result.type === 'failure') {
						toast.error('Could not update account');
					}
				};
			}}
		>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
				<Button
					type="submit"
					variant={mode === 'deactivate' ? 'destructive' : 'default'}
					disabled={submitting}
				>
					{submitting ? 'Working…' : mode === 'deactivate' ? 'Deactivate' : 'Reactivate'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
