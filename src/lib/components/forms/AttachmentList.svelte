<script lang="ts">
	import { toast } from 'svelte-sonner';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import FileIcon from '@lucide/svelte/icons/file';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import DownloadIcon from '@lucide/svelte/icons/download';

	export type Attachment = {
		id: string;
		originalFilename: string;
		mimeType: string;
		sizeBytes: number;
		secureUrl: string;
		cloudinaryPublicId: string;
	};

	type Props = {
		attachments: Attachment[];
		canDelete?: boolean;
		onDeleted?: (id: string) => void;
	};

	let { attachments = $bindable([]), canDelete = false, onDeleted }: Props = $props();

	let deleting = $state<Set<string>>(new Set());

	function humanSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function isImage(mimeType: string): boolean {
		return mimeType.startsWith('image/');
	}

	// Append Cloudinary transform params to produce a thumbnail URL.
	function thumbUrl(secureUrl: string): string {
		// Insert transformation before the version segment or the filename.
		// Cloudinary URLs look like: https://res.cloudinary.com/{cloud}/{type}/upload/{version}/{public_id}
		// We inject the transform between /upload/ and the rest.
		return secureUrl.replace('/upload/', '/upload/w_400,h_400,c_fill,f_auto,q_auto/');
	}

	async function deleteAttachment(attachment: Attachment) {
		if (deleting.has(attachment.id)) return;
		deleting = new Set([...deleting, attachment.id]);

		// Optimistic removal
		const prev = attachments;
		attachments = attachments.filter((a) => a.id !== attachment.id);

		try {
			const res = await fetch('/api/attachments', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ attachmentId: attachment.id })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			onDeleted?.(attachment.id);
		} catch (err) {
			console.error('[attachments] delete failed', err);
			// Roll back
			attachments = prev;
			toast.error('Could not delete attachment');
		} finally {
			deleting = new Set([...deleting].filter((id) => id !== attachment.id));
		}
	}
</script>

{#if attachments.length > 0}
	<ul class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
		{#each attachments as attachment (attachment.id)}
			<li class="group relative rounded-lg border bg-muted/30 p-2">
				{#if isImage(attachment.mimeType)}
					<img
						src={thumbUrl(attachment.secureUrl)}
						alt={attachment.originalFilename}
						class="mb-1.5 h-24 w-full rounded object-cover"
						loading="lazy"
					/>
				{:else}
					<div class="mb-1.5 flex h-24 items-center justify-center rounded bg-muted">
						{#if attachment.mimeType === 'application/pdf' || attachment.originalFilename.endsWith('.pdf')}
							<FileTextIcon class="size-8 text-muted-foreground" />
						{:else}
							<FileIcon class="size-8 text-muted-foreground" />
						{/if}
					</div>
				{/if}
				<p class="truncate text-xs font-medium" title={attachment.originalFilename}>
					{attachment.originalFilename}
				</p>
				<p class="text-xs text-muted-foreground">{humanSize(attachment.sizeBytes)}</p>
				<div
					class="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
				>
					<a
						href={attachment.secureUrl}
						download={attachment.originalFilename}
						target="_blank"
						rel="noopener noreferrer"
						class="flex size-6 items-center justify-center rounded bg-background/80 backdrop-blur hover:bg-background"
						aria-label="Download {attachment.originalFilename}"
					>
						<DownloadIcon class="size-3.5" />
					</a>
					{#if canDelete}
						<button
							type="button"
							disabled={deleting.has(attachment.id)}
							onclick={() => deleteAttachment(attachment)}
							class="hover:text-destructive-foreground flex size-6 items-center justify-center rounded bg-background/80 backdrop-blur hover:bg-destructive disabled:opacity-50"
							aria-label="Delete {attachment.originalFilename}"
						>
							<Trash2Icon class="size-3.5" />
						</button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}
