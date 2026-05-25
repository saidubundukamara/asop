<script lang="ts">
	let {
		fieldId,
		label,
		helpText = '',
		isRequired = false,
		fieldType = 'date',
		value = $bindable(''),
		readonly = false,
		error = ''
	}: {
		fieldId: string;
		label: string;
		helpText?: string;
		isRequired?: boolean;
		fieldType?: 'date' | 'datetime';
		value?: string;
		readonly?: boolean;
		error?: string;
	} = $props();

	const inputType = $derived(fieldType === 'datetime' ? 'datetime-local' : 'date');
</script>

<div class="space-y-1">
	<label for={fieldId} class="block text-sm font-medium">
		{label}{#if isRequired}<span class="ml-0.5 text-destructive">*</span>{/if}
	</label>
	{#if helpText}<p class="text-xs text-muted-foreground">{helpText}</p>{/if}
	{#if readonly}
		<p class="min-h-[2rem] rounded-md border bg-muted/30 px-3 py-2 text-sm">
			{value ? new Date(value).toLocaleString() : '—'}
		</p>
	{:else}
		<input
			id={fieldId}
			type={inputType}
			bind:value
			required={isRequired}
			class="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none
				{error ? 'border-destructive' : ''}"
		/>
		{#if error}<p class="text-xs text-destructive">{error}</p>{/if}
	{/if}
</div>
