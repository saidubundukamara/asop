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
		configJson?: { options?: string[] } | null;
		defaultValue?: string;
		value?: string;
		readonly?: boolean;
		error?: string;
	} = $props();

	const options = configJson?.options ?? [];
	if (!value && defaultValue) value = defaultValue;
</script>

<div class="space-y-1">
	<label for={fieldId} class="block text-sm font-medium">
		{label}{#if isRequired}<span class="ml-0.5 text-destructive">*</span>{/if}
	</label>
	{#if helpText}<p class="text-xs text-muted-foreground">{helpText}</p>{/if}
	{#if readonly}
		<p class="min-h-[2rem] rounded-md border bg-muted/30 px-3 py-2 text-sm">{value || '—'}</p>
	{:else}
		<select
			id={fieldId}
			bind:value
			required={isRequired}
			class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none
				{error ? 'border-destructive' : ''}"
		>
			<option value="">Select…</option>
			{#each options as opt (opt)}
				<option value={opt}>{opt}</option>
			{/each}
		</select>
		{#if error}<p class="text-xs text-destructive">{error}</p>{/if}
	{/if}
</div>
