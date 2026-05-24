<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';

	// FR-REP-4 — "Request revision" requires a comment explaining what to fix.
	// Implemented as a Sheet (not Dialog) to match the create-flow pattern.

	let {
		open,
		reportId,
		actionBase = '?/',
		onclose
	}: {
		open: boolean;
		reportId: string;
		actionBase?: string;
		onclose: () => void;
	} = $props();

	let comment = $state('');
	let submitting = $state(false);
	let commentError = $state('');

	function handleOpenChange(v: boolean) {
		if (!v) onclose();
	}
</script>

<Sheet.Root {open} onOpenChange={handleOpenChange}>
	<Sheet.Content side="bottom" class="max-h-[90dvh] rounded-t-2xl sm:mx-auto sm:max-w-lg">
		<Sheet.Header>
			<Sheet.Title>Request revision</Sheet.Title>
			<Sheet.Description>
				Describe what needs to be changed. The author will be notified.
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action="{actionBase}review"
			use:enhance={({ cancel }) => {
				if (!comment.trim()) {
					commentError = 'Please describe what needs to be revised.';
					cancel();
					return;
				}
				commentError = '';
				submitting = true;
				return async ({ result, update }) => {
					submitting = false;
					await update({ reset: false });
					if (result.type === 'success') {
						toast.success('Revision requested');
						comment = '';
						onclose();
					} else {
						toast.error('Could not request revision');
					}
				};
			}}
			class="mt-4 space-y-4"
		>
			<input type="hidden" name="reportId" value={reportId} />
			<input type="hidden" name="decision" value="request_revision" />

			<div>
				<label for="revision-comment" class="mb-1 block text-sm font-medium">
					Comment <span class="text-destructive">*</span>
				</label>
				<textarea
					id="revision-comment"
					name="comment"
					bind:value={comment}
					rows="4"
					placeholder="E.g. Please add the beneficiary count for each location."
					class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none
						{commentError ? 'border-destructive' : ''}"
				></textarea>
				{#if commentError}
					<p class="mt-0.5 text-xs text-destructive">{commentError}</p>
				{/if}
			</div>

			<div class="flex justify-end gap-2 pb-4">
				<Button type="button" variant="outline" onclick={onclose}>Cancel</Button>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Sending…' : 'Request revision'}
				</Button>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>
