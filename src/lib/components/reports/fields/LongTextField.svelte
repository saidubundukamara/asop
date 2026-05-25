<script lang="ts">
	let {
		fieldId,
		label,
		helpText = '',
		isRequired = false,
		configJson = null,
		defaultValue = '',
		value = $bindable(''),
		readonly = false,
		error = ''
	}: {
		fieldId: string;
		label: string;
		helpText?: string;
		isRequired?: boolean;
		configJson?: { min?: number; max?: number } | null;
		defaultValue?: string;
		value?: string;
		readonly?: boolean;
		error?: string;
	} = $props();

	const maxLength = $derived(configJson?.max ?? 5000);
	$effect(() => {
		if (!value && defaultValue) value = defaultValue;
	});
</script>

<div class="space-y-1">
	<label for={fieldId} class="block text-sm font-medium">
		{label}{#if isRequired}<span class="ml-0.5 text-destructive">*</span>{/if}
	</label>
	{#if helpText}<p class="text-xs text-muted-foreground">{helpText}</p>{/if}
	{#if readonly}
		<p class="min-h-[4rem] rounded-md border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
			{value || '—'}
		</p>
	{:else}
		<textarea
			id={fieldId}
			bind:value
			maxlength={maxLength}
			required={isRequired}
			rows="4"
			class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none
				{error ? 'border-destructive' : ''}"
		></textarea>
		{#if error}<p class="text-xs text-destructive">{error}</p>{/if}
	{/if}
</div>
