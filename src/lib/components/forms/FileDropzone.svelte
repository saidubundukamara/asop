<script lang="ts">
	import { toast } from 'svelte-sonner';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import XIcon from '@lucide/svelte/icons/x';
	import AttachmentList from './AttachmentList.svelte';
	import type { Attachment } from './AttachmentList.svelte';

	// FR-FILE-1 (PRD § 15.4): two-step direct-to-Cloudinary upload.
	// 1. GET signed params from /api/uploads/sign
	// 2. POST bytes straight to Cloudinary (XHR for per-file progress)
	// 3. POST {public_id, secure_url, …} to /api/attachments to record in our DB
	//
	// When ownerId is null (creation mode), files are held client-side and
	// uploaded later by calling flush(ownerId). The parent calls flush() after
	// the entity (task/report) is created and has an ID.

	type PendingFile = {
		id: string; // local ephemeral id
		file: File;
		progress: number; // 0–100
		xhr: XMLHttpRequest | null;
		error: string | null;
	};

	type Props = {
		ownerType: 'task' | 'task_comment' | 'report' | 'report_comment';
		ownerId: string | null;
		folder: string; // Cloudinary folder, e.g. 'task-attachments'
		existingAttachments?: Attachment[];
		canDelete?: boolean;
		accept?: string;
		maxFiles?: number;
		maxSizeMb?: number;
		readonly?: boolean;
		onAttachmentAdded?: (a: Attachment) => void;
		onAttachmentRemoved?: (id: string) => void;
	};

	let {
		ownerType,
		ownerId,
		folder,
		existingAttachments = $bindable([]),
		canDelete = false,
		accept = '*',
		maxFiles = 10,
		maxSizeMb = 25,
		readonly = false,
		onAttachmentAdded,
		onAttachmentRemoved
	}: Props = $props();

	let inputEl: HTMLInputElement | undefined = $state();
	let pending = $state<PendingFile[]>([]);
	let dragOver = $state(false);

	const maxSizeBytes = $derived(maxSizeMb * 1024 * 1024);
	const usedSlots = $derived(existingAttachments.length + pending.length);

	function uniqueId(): string {
		return Math.random().toString(36).slice(2);
	}

	function validateFile(file: File): string | null {
		if (file.size > maxSizeBytes) return `"${file.name}" exceeds ${maxSizeMb} MB`;
		if (usedSlots >= maxFiles) return `Maximum ${maxFiles} files`;
		return null;
	}

	function addFiles(files: File[]) {
		for (const file of files) {
			const err = validateFile(file);
			if (err) {
				toast.error(err);
				continue;
			}
			const pf: PendingFile = { id: uniqueId(), file, progress: 0, xhr: null, error: null };
			pending = [...pending, pf];

			if (ownerId) {
				void uploadOne(pf, ownerId);
			}
			// If ownerId is null, the file sits in pending until flush() is called.
		}
	}

	async function uploadOne(pf: PendingFile, resolvedOwnerId: string): Promise<Attachment | null> {
		// Step 1: get signed params
		let signed: {
			signature: string;
			timestamp: number;
			apiKey: string;
			cloudName: string;
			folder: string;
			publicId?: string;
		};
		try {
			const signRes = await fetch('/api/uploads/sign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folder })
			});
			if (!signRes.ok) throw new Error(`Sign failed: ${signRes.status}`);
			signed = await signRes.json();
		} catch (err) {
			console.error('[file-dropzone] sign error', err);
			setPendingError(pf.id, 'Upload failed (sign)');
			return null;
		}

		// Step 2: upload directly to Cloudinary via XHR for progress tracking
		return new Promise<Attachment | null>((resolve) => {
			const formData = new FormData();
			formData.append('file', pf.file);
			formData.append('api_key', signed.apiKey);
			formData.append('timestamp', String(signed.timestamp));
			formData.append('signature', signed.signature);
			formData.append('folder', signed.folder);
			if (signed.publicId) formData.append('public_id', signed.publicId);

			const resourceType = pf.file.type.startsWith('image/') ? 'image' : 'raw';
			const url = `https://api.cloudinary.com/v1_1/${signed.cloudName}/${resourceType}/upload`;

			const xhr = new XMLHttpRequest();
			setPendingXhr(pf.id, xhr);

			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) {
					setPendingProgress(pf.id, Math.round((e.loaded / e.total) * 90));
				}
			};

			xhr.onload = async () => {
				if (xhr.status < 200 || xhr.status >= 300) {
					setPendingError(pf.id, 'Upload to storage failed');
					resolve(null);
					return;
				}
				const cld = JSON.parse(xhr.responseText) as {
					public_id: string;
					secure_url: string;
					format?: string;
					bytes: number;
					original_filename: string;
				};

				// Step 3: record in our DB
				try {
					const res = await fetch('/api/attachments', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							ownerType,
							ownerId: resolvedOwnerId,
							cloudinaryPublicId: cld.public_id,
							secureUrl: cld.secure_url,
							mimeType: pf.file.type || 'application/octet-stream',
							sizeBytes: cld.bytes,
							originalFilename: pf.file.name
						})
					});
					if (!res.ok) throw new Error(`Record failed: ${res.status}`);
					const attachment: Attachment = await res.json();

					// Move from pending to existing
					pending = pending.filter((p) => p.id !== pf.id);
					existingAttachments = [...existingAttachments, attachment];
					onAttachmentAdded?.(attachment);
					resolve(attachment);
				} catch (err) {
					console.error('[file-dropzone] record error', err);
					setPendingError(pf.id, 'Could not save file reference');
					resolve(null);
				}
			};

			xhr.onerror = () => {
				setPendingError(pf.id, 'Network error during upload');
				resolve(null);
			};

			xhr.open('POST', url);
			xhr.send(formData);
		});
	}

	function setPendingProgress(id: string, progress: number) {
		pending = pending.map((p) => (p.id === id ? { ...p, progress } : p));
	}
	function setPendingXhr(id: string, xhr: XMLHttpRequest) {
		pending = pending.map((p) => (p.id === id ? { ...p, xhr } : p));
	}
	function setPendingError(id: string, err: string) {
		pending = pending.map((p) => (p.id === id ? { ...p, error: err, xhr: null } : p));
	}

	function cancelPending(id: string) {
		const pf = pending.find((p) => p.id === id);
		pf?.xhr?.abort();
		pending = pending.filter((p) => p.id !== id);
	}

	// Called by the parent after entity creation to upload queued files.
	export async function flush(resolvedOwnerId: string): Promise<Attachment[]> {
		const queued = pending.filter((p) => !p.error && !p.xhr);
		const results = await Promise.all(queued.map((pf) => uploadOne(pf, resolvedOwnerId)));
		return results.filter((a): a is Attachment => a !== null);
	}

	function onFileInput(e: Event) {
		const files = Array.from((e.currentTarget as HTMLInputElement).files ?? []);
		if (inputEl) inputEl.value = '';
		addFiles(files);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const files = Array.from(e.dataTransfer?.files ?? []);
		addFiles(files);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}
</script>

{#if !readonly}
	<div
		role="button"
		tabindex="0"
		class="rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors {dragOver
			? 'border-primary bg-primary/5'
			: 'border-muted-foreground/25 hover:border-muted-foreground/50'}"
		ondrop={onDrop}
		ondragover={onDragOver}
		ondragleave={() => (dragOver = false)}
		onclick={() => inputEl?.click()}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && inputEl?.click()}
	>
		<PaperclipIcon class="mx-auto size-5 text-muted-foreground" />
		<p class="mt-1.5 text-sm text-muted-foreground">
			Drag files here or <span class="text-foreground underline underline-offset-2">browse</span>
		</p>
		<p class="mt-0.5 text-xs text-muted-foreground">
			Up to {maxFiles} files · max {maxSizeMb} MB each
		</p>
	</div>

	<!-- capture="environment" gives the native camera/gallery picker on mobile -->
	<input
		bind:this={inputEl}
		type="file"
		{accept}
		multiple
		capture="environment"
		class="sr-only"
		onchange={onFileInput}
	/>
{/if}

{#if pending.length > 0}
	<ul class="mt-2 space-y-1.5">
		{#each pending as pf (pf.id)}
			<li class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
				<span class="min-w-0 flex-1 truncate">{pf.file.name}</span>
				{#if pf.error}
					<span class="text-xs text-destructive">{pf.error}</span>
				{:else}
					<div class="h-1.5 w-20 shrink-0 rounded-full bg-muted">
						<div
							class="h-full rounded-full bg-primary transition-[width]"
							style="width: {pf.progress}%"
						></div>
					</div>
				{/if}
				{#if !readonly}
					<button
						type="button"
						onclick={() => cancelPending(pf.id)}
						class="shrink-0 text-muted-foreground hover:text-foreground"
						aria-label="Cancel {pf.file.name}"
					>
						<XIcon class="size-3.5" />
					</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<AttachmentList
	bind:attachments={existingAttachments}
	{canDelete}
	onDeleted={(id) => {
		onAttachmentRemoved?.(id);
	}}
/>
