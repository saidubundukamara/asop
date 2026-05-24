<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import FileDropzone from '$lib/components/forms/FileDropzone.svelte';

	let submitting = $state(false);
	let body = $state('');
	let issues = $state<Record<string, string[]> | null>(null);
	let dropzoneRef: FileDropzone | undefined = $state();
</script>

<form
	method="POST"
	action="?/addComment"
	use:enhance={() => {
		submitting = true;
		issues = null;
		return async ({ result, update }) => {
			submitting = false;
			if (result.type === 'success') {
				const commentId = (result.data as { data?: { id?: string } } | undefined)?.data?.id;
				body = '';
				issues = null;
				await update({ reset: true });
				// Upload any queued attachment files now that we have the comment id.
				if (commentId && dropzoneRef) {
					void dropzoneRef.flush(commentId).catch(() => {});
				}
				toast.success('Comment added');
			} else if (result.type === 'failure') {
				await update({ reset: false });
				const fail = result.data as { issues?: Record<string, string[]> } | undefined;
				issues = fail?.issues ?? null;
				toast.error(Object.values(fail?.issues ?? {})[0]?.[0] ?? 'Could not add comment');
			}
		};
	}}
	class="grid gap-2"
>
	<label for="comment-body" class="sr-only">Add a comment</label>
	<textarea
		id="comment-body"
		name="body"
		bind:value={body}
		rows="3"
		maxlength={5000}
		required
		placeholder="Write a comment. Use @name to mention someone."
		class="min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
	></textarea>
	{#if issues?.body}<p class="text-xs text-destructive">{issues.body[0]}</p>{/if}

	<FileDropzone
		bind:this={dropzoneRef}
		ownerType="task_comment"
		ownerId={null}
		folder="comment-attachments"
	/>

	<div class="flex justify-end">
		<Button type="submit" disabled={submitting || body.trim().length === 0}>
			{submitting ? 'Posting…' : 'Post comment'}
		</Button>
	</div>
</form>
