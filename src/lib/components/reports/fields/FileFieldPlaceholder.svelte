<script lang="ts">
	let {
		label,
		helpText = '',
		isRequired = false,
		readonly = false
	}: {
		label: string;
		helpText?: string;
		isRequired?: boolean;
		readonly?: boolean;
	} = $props();
</script>

<div class="space-y-1">
	<span class="block text-sm font-medium">
		{label}{#if isRequired}<span class="ml-0.5 text-destructive">*</span>{/if}
	</span>
	{#if helpText}<p class="text-xs text-muted-foreground">{helpText}</p>{/if}
	<div class="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center">
		{#if readonly}
			<p class="text-sm text-muted-foreground">File attachments — available after Phase 6</p>
		{:else}
			<p class="text-sm text-muted-foreground">
				File upload coming in the next release. You can add attachments to the task or report
				comments for now.
			</p>
		{/if}
	</div>
</div>
