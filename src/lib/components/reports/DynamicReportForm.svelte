<script lang="ts">
	import ShortTextField from './fields/ShortTextField.svelte';
	import LongTextField from './fields/LongTextField.svelte';
	import NumberField from './fields/NumberField.svelte';
	import DateField from './fields/DateField.svelte';
	import DropdownField from './fields/DropdownField.svelte';
	import MultiSelectField from './fields/MultiSelectField.svelte';
	import CheckboxField from './fields/CheckboxField.svelte';
	import GeolocationField from './fields/GeolocationField.svelte';
	import FileFieldPlaceholder from './fields/FileFieldPlaceholder.svelte';

	type ReportField = {
		id: string;
		label: string;
		fieldType: string;
		helpText: string | null;
		isRequired: boolean;
		displayOrder: number;
		configJson: unknown;
		defaultValue: string | null;
	};

	let {
		fields,
		values = $bindable({}),
		issues = {},
		readonly = false
	}: {
		fields: ReportField[];
		values?: Record<string, unknown>;
		issues?: Record<string, string[]>;
		readonly?: boolean;
	} = $props();

	// Normalize existing values (from DB) into the bindable state.
	// DB stores: valueText, valueNumber, valueDate, valueJson — we coerce to
	// a single value per field for the UI to bind to.
	function getInitial(field: ReportField): unknown {
		const stored = values[field.id];
		if (stored === undefined || stored === null) return getDefault(field);
		// If the stored value is an object with DB-column keys, unwrap it.
		if (typeof stored === 'object' && !Array.isArray(stored) && stored !== null) {
			const s = stored as Record<string, unknown>;
			if ('valueText' in s) return s.valueText ?? '';
			if ('valueNumber' in s) return s.valueNumber ?? '';
			if ('valueDate' in s) return s.valueDate ?? '';
			if ('valueJson' in s) return s.valueJson ?? getDefault(field);
		}
		return stored;
	}

	function getDefault(field: ReportField): unknown {
		switch (field.fieldType) {
			case 'checkbox':
				return false;
			case 'multi_select':
				return [];
			case 'geolocation':
				return null;
			default:
				return field.defaultValue ?? '';
		}
	}

	// Initialise mutable state keyed by fieldId.
	let localValues = $state<Record<string, unknown>>(
		Object.fromEntries(fields.map((f) => [f.id, getInitial(f)]))
	);

	// Keep parent's `values` in sync so the autosave can read it.
	$effect(() => {
		values = { ...localValues };
	});
</script>

<div class="space-y-5">
	{#each fields as field (field.id)}
		{@const fieldError = (issues[`field_${field.id}`] ?? [])[0] ?? ''}
		{@const config = field.configJson as Record<string, unknown> | null}

		{#if field.fieldType === 'short_text'}
			<ShortTextField
				fieldId={field.id}
				label={field.label}
				helpText={field.helpText ?? ''}
				isRequired={field.isRequired}
				configJson={config}
				defaultValue={field.defaultValue ?? ''}
				bind:value={localValues[field.id] as string}
				{readonly}
				error={fieldError}
			/>
		{:else if field.fieldType === 'long_text'}
			<LongTextField
				fieldId={field.id}
				label={field.label}
				helpText={field.helpText ?? ''}
				isRequired={field.isRequired}
				configJson={config}
				defaultValue={field.defaultValue ?? ''}
				bind:value={localValues[field.id] as string}
				{readonly}
				error={fieldError}
			/>
		{:else if field.fieldType === 'number'}
			<NumberField
				fieldId={field.id}
				label={field.label}
				helpText={field.helpText ?? ''}
				isRequired={field.isRequired}
				configJson={config}
				defaultValue={field.defaultValue ?? ''}
				bind:value={localValues[field.id] as number | string}
				{readonly}
				error={fieldError}
			/>
		{:else if field.fieldType === 'date' || field.fieldType === 'datetime'}
			<DateField
				fieldId={field.id}
				label={field.label}
				helpText={field.helpText ?? ''}
				isRequired={field.isRequired}
				fieldType={field.fieldType as 'date' | 'datetime'}
				bind:value={localValues[field.id] as string}
				{readonly}
				error={fieldError}
			/>
		{:else if field.fieldType === 'dropdown'}
			<DropdownField
				fieldId={field.id}
				label={field.label}
				helpText={field.helpText ?? ''}
				isRequired={field.isRequired}
				configJson={config as { options?: string[] } | null}
				defaultValue={field.defaultValue ?? ''}
				bind:value={localValues[field.id] as string}
				{readonly}
				error={fieldError}
			/>
		{:else if field.fieldType === 'multi_select'}
			<MultiSelectField
				fieldId={field.id}
				label={field.label}
				helpText={field.helpText ?? ''}
				isRequired={field.isRequired}
				configJson={config as { options?: string[] } | null}
				bind:value={localValues[field.id] as string[]}
				{readonly}
				error={fieldError}
			/>
		{:else if field.fieldType === 'checkbox'}
			<CheckboxField
				fieldId={field.id}
				label={field.label}
				helpText={field.helpText ?? ''}
				isRequired={field.isRequired}
				bind:value={localValues[field.id] as boolean}
				{readonly}
				error={fieldError}
			/>
		{:else if field.fieldType === 'geolocation'}
			<GeolocationField
				fieldId={field.id}
				label={field.label}
				helpText={field.helpText ?? ''}
				isRequired={field.isRequired}
				bind:value={localValues[field.id] as { lat: number; lng: number } | null}
				{readonly}
				error={fieldError}
			/>
		{:else if field.fieldType === 'file'}
			<FileFieldPlaceholder
				label={field.label}
				helpText={field.helpText ?? ''}
				isRequired={field.isRequired}
				{readonly}
			/>
		{/if}
	{/each}
</div>
