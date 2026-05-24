<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import RequestRevisionSheet from './RequestRevisionSheet.svelte';

	let {
		reportId,
		actionBase = '?/'
	}: {
		reportId: string;
		actionBase?: string;
	} = $props();

	let approving = $state(false);
	let revisionSheetOpen = $state(false);
</script>

<div class="rounded-lg border border-border bg-muted/30 p-4">
	<h3 class="mb-3 text-sm font-semibold">Review actions</h3>
	<div class="flex flex-wrap gap-2">
		<form
			method="POST"
			action="{actionBase}review"
			use:enhance={() => {
				approving = true;
				return async ({ result, update }) => {
					approving = false;
					await update({ reset: false });
					if (result.type === 'failure') toast.error('Could not approve report');
				};
			}}
		>
			<input type="hidden" name="reportId" value={reportId} />
			<input type="hidden" name="decision" value="approve" />
			<Button type="submit" disabled={approving}>
				{approving ? 'Approving…' : 'Approve'}
			</Button>
		</form>

		<Button variant="outline" onclick={() => (revisionSheetOpen = true)}>Request revision</Button>
	</div>
</div>

<RequestRevisionSheet
	open={revisionSheetOpen}
	{reportId}
	{actionBase}
	onclose={() => (revisionSheetOpen = false)}
/>
