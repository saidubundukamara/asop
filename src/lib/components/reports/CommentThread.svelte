<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';

	type Comment = {
		id: string;
		body: string;
		createdAt: Date | string;
		editedAt: Date | string | null;
		canEdit: boolean;
		canDelete: boolean;
		author: { id: string; name: string; photoUrl: string | null } | null;
	};

	let { comments }: { comments: Comment[] } = $props();

	let editingId = $state<string | null>(null);
	let editBuf = $state('');
	let busyId = $state<string | null>(null);

	function startEdit(c: Comment) {
		editingId = c.id;
		editBuf = c.body;
	}

	function cancelEdit() {
		editingId = null;
		editBuf = '';
	}

	function fmt(dt: Date | string): string {
		const d = typeof dt === 'string' ? new Date(dt) : dt;
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('');
	}
</script>

{#if comments.length === 0}
	<p class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
		No comments yet.
	</p>
{:else}
	<ul class="space-y-3">
		{#each comments as c (c.id)}
			<li class="rounded-lg border bg-background p-3">
				<div class="flex items-start gap-2.5">
					<Avatar class="size-8">
						{#if c.author?.photoUrl}<AvatarImage src={c.author.photoUrl} alt="" />{/if}
						<AvatarFallback class="text-xs">
							{c.author ? initials(c.author.name) : '?'}
						</AvatarFallback>
					</Avatar>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline gap-2 text-xs text-muted-foreground">
							<span class="font-medium text-foreground">{c.author?.name ?? '— deleted user —'}</span
							>
							<span>{fmt(c.createdAt)}</span>
							{#if c.editedAt}<span class="italic">(edited)</span>{/if}
						</div>

						{#if editingId === c.id}
							<form
								method="POST"
								action="?/editComment"
								use:enhance={() => {
									busyId = c.id;
									return async ({ result, update }) => {
										busyId = null;
										if (result.type === 'success') {
											editingId = null;
											editBuf = '';
											await update({ reset: false });
											toast.success('Comment updated');
										} else {
											await update({ reset: false });
											toast.error('Edit window has closed');
										}
									};
								}}
								class="mt-1 grid gap-2"
							>
								<input type="hidden" name="commentId" value={c.id} />
								<textarea
									name="body"
									bind:value={editBuf}
									rows="3"
									maxlength={10000}
									required
									class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
								></textarea>
								<div class="flex gap-2">
									<Button type="submit" size="sm" disabled={busyId === c.id}>Save</Button>
									<Button type="button" size="sm" variant="outline" onclick={cancelEdit}
										>Cancel</Button
									>
								</div>
							</form>
						{:else}
							<p class="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
							<div class="mt-2 flex gap-2">
								{#if c.canEdit}
									<button
										type="button"
										class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
										onclick={() => startEdit(c)}
									>
										<PencilIcon class="size-3" /> Edit
									</button>
								{/if}
								{#if c.canDelete}
									<form
										method="POST"
										action="?/deleteComment"
										use:enhance={() => {
											busyId = c.id;
											return async ({ result, update }) => {
												busyId = null;
												await update({ reset: false });
												if (result.type === 'success') toast.success('Comment removed');
												else toast.error('Could not delete');
											};
										}}
									>
										<input type="hidden" name="commentId" value={c.id} />
										<button
											type="submit"
											disabled={busyId === c.id}
											class="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
										>
											<Trash2Icon class="size-3" /> Delete
										</button>
									</form>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</li>
		{/each}
	</ul>
{/if}
