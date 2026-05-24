<script lang="ts">
	import FileDropzone from '$lib/components/forms/FileDropzone.svelte';
	import type { Attachment } from '$lib/components/forms/AttachmentList.svelte';

	type Props = {
		label: string;
		helpText?: string;
		isRequired?: boolean;
		readonly?: boolean;
		reportId: string | null; // null when creating a new report
		canDelete?: boolean;
		existingAttachments?: Attachment[];
	};

	let {
		label,
		helpText = '',
		isRequired = false,
		readonly = false,
		reportId,
		canDelete = false,
		existingAttachments = $bindable([])
	}: Props = $props();

	let dropzoneRef: FileDropzone | undefined = $state();

	// Expose flush() so DynamicReportForm can drain the queue after creation.
	export function flush(resolvedReportId: string) {
		return dropzoneRef?.flush(resolvedReportId) ?? Promise.resolve([]);
	}
</script>

<div class="space-y-1.5">
	<span class="block text-sm font-medium">
		{label}{#if isRequired}<span class="ml-0.5 text-destructive">*</span>{/if}
	</span>
	{#if helpText}<p class="text-xs text-muted-foreground">{helpText}</p>{/if}
	<FileDropzone
		bind:this={dropzoneRef}
		ownerType="report"
		ownerId={reportId}
		folder="report-attachments"
		bind:existingAttachments
		{canDelete}
		{readonly}
	/>
</div>
