<script lang="ts">
	let {
		fieldId,
		label,
		helpText = '',
		isRequired = false,
		value = $bindable(false),
		readonly = false,
		error = ''
	}: {
		fieldId: string;
		label: string;
		helpText?: string;
		isRequired?: boolean;
		value?: boolean;
		readonly?: boolean;
		error?: string;
	} = $props();
</script>

<div class="space-y-1">
	{#if readonly}
		<div class="flex items-center gap-2 text-sm">
			<span
				class="inline-block size-4 rounded border {value
					? 'border-primary bg-primary'
					: 'border-input bg-background'}"
			></span>
			<span class="font-medium">{label}</span>
			<span class="text-muted-foreground">{value ? 'Yes' : 'No'}</span>
		</div>
	{:else}
		<label class="flex cursor-pointer items-center gap-2 text-sm">
			<input id={fieldId} type="checkbox" bind:checked={value} class="rounded border-input" />
			<span class="font-medium"
				>{label}{#if isRequired}<span class="ml-0.5 text-destructive">*</span>{/if}</span
			>
		</label>
		{#if helpText}<p class="text-xs text-muted-foreground">{helpText}</p>{/if}
		{#if error}<p class="text-xs text-destructive">{error}</p>{/if}
	{/if}
</div>
