<script lang="ts">
	let {
		fieldId,
		label,
		helpText = '',
		isRequired = false,
		configJson = null,
		value = $bindable<string[]>([]),
		readonly = false,
		error = ''
	}: {
		fieldId: string;
		label: string;
		helpText?: string;
		isRequired?: boolean;
		configJson?: { options?: string[] } | null;
		value?: string[];
		readonly?: boolean;
		error?: string;
	} = $props();

	const options = configJson?.options ?? [];

	function toggle(opt: string) {
		if (value.includes(opt)) {
			value = value.filter((v) => v !== opt);
		} else {
			value = [...value, opt];
		}
	}
</script>

<div id={fieldId} class="space-y-1">
	<span class="block text-sm font-medium">
		{label}{#if isRequired}<span class="ml-0.5 text-destructive">*</span>{/if}
	</span>
	{#if helpText}<p class="text-xs text-muted-foreground">{helpText}</p>{/if}
	{#if readonly}
		<p class="min-h-[2rem] rounded-md border bg-muted/30 px-3 py-2 text-sm">
			{value.length > 0 ? value.join(', ') : '—'}
		</p>
	{:else}
		<div class="space-y-1 rounded-md border p-3" class:border-destructive={!!error}>
			{#each options as opt (opt)}
				<label class="flex cursor-pointer items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={value.includes(opt)}
						onchange={() => toggle(opt)}
						class="rounded border-input"
					/>
					{opt}
				</label>
			{/each}
			{#if options.length === 0}
				<p class="text-xs text-muted-foreground">No options defined.</p>
			{/if}
		</div>
		{#if error}<p class="text-xs text-destructive">{error}</p>{/if}
	{/if}
</div>
