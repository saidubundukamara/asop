<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button';

	type Field = {
		label: string;
		fieldType: string;
		helpText: string;
		isRequired: boolean;
		displayOrder: number;
		configJson: string; // JSON string for type-specific config
		defaultValue: string;
	};

	const FIELD_TYPES = [
		{ value: 'short_text', label: 'Short text' },
		{ value: 'long_text', label: 'Long text' },
		{ value: 'number', label: 'Number' },
		{ value: 'date', label: 'Date' },
		{ value: 'datetime', label: 'Date & time' },
		{ value: 'dropdown', label: 'Dropdown' },
		{ value: 'multi_select', label: 'Multi-select' },
		{ value: 'checkbox', label: 'Checkbox (yes/no)' },
		{ value: 'file', label: 'File / image' },
		{ value: 'geolocation', label: 'Geolocation' }
	];

	let { fields = $bindable([]) }: { fields: Field[] } = $props();

	function addField() {
		fields = [
			...fields,
			{
				label: '',
				fieldType: 'short_text',
				helpText: '',
				isRequired: false,
				displayOrder: fields.length,
				configJson: '',
				defaultValue: ''
			}
		];
	}

	function removeField(i: number) {
		fields = fields.filter((_, idx) => idx !== i).map((f, idx) => ({ ...f, displayOrder: idx }));
	}

	function moveUp(i: number) {
		if (i === 0) return;
		const next = [...fields];
		[next[i - 1], next[i]] = [next[i], next[i - 1]];
		fields = next.map((f, idx) => ({ ...f, displayOrder: idx }));
	}

	function moveDown(i: number) {
		if (i >= fields.length - 1) return;
		const next = [...fields];
		[next[i], next[i + 1]] = [next[i + 1], next[i]];
		fields = next.map((f, idx) => ({ ...f, displayOrder: idx }));
	}

	// Returns true if this field type needs an "options" config.
	function hasOptions(type: string) {
		return type === 'dropdown' || type === 'multi_select';
	}

	// Parse/encode options list (newline-separated in UI → JSON array).
	function getOptionsText(field: Field): string {
		try {
			const parsed = JSON.parse(field.configJson || '{}');
			return (parsed.options ?? []).join('\n');
		} catch {
			return '';
		}
	}

	function setOptions(i: number, text: string) {
		const options = text
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean);
		fields[i] = { ...fields[i], configJson: JSON.stringify({ options }) };
	}
</script>

<div class="space-y-3">
	{#each fields as field, i (i)}
		<div class="rounded-lg border bg-muted/20 p-3">
			<div class="mb-2 flex items-center gap-1">
				<span class="flex-1 text-xs font-semibold text-muted-foreground">Field {i + 1}</span>
				<button
					type="button"
					onclick={() => moveUp(i)}
					disabled={i === 0}
					class="rounded p-1 hover:bg-muted disabled:opacity-30"
					aria-label="Move up"
				>
					<ChevronUpIcon class="size-3.5" />
				</button>
				<button
					type="button"
					onclick={() => moveDown(i)}
					disabled={i === fields.length - 1}
					class="rounded p-1 hover:bg-muted disabled:opacity-30"
					aria-label="Move down"
				>
					<ChevronDownIcon class="size-3.5" />
				</button>
				<button
					type="button"
					onclick={() => removeField(i)}
					class="rounded p-1 text-destructive hover:bg-destructive/10"
					aria-label="Remove field"
				>
					<Trash2Icon class="size-3.5" />
				</button>
			</div>

			<div class="grid gap-2 sm:grid-cols-2">
				<label class="block text-xs font-medium">
					<span class="mb-1 block">Label *</span>
					<input
						type="text"
						bind:value={fields[i].label}
						required
						maxlength="200"
						placeholder="e.g. Beneficiary count"
						class="w-full rounded-md border px-2 py-1.5 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
					/>
				</label>
				<label class="block text-xs font-medium">
					<span class="mb-1 block">Type</span>
					<select
						bind:value={fields[i].fieldType}
						class="w-full rounded-md border px-2 py-1.5 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
					>
						{#each FIELD_TYPES as t (t.value)}
							<option value={t.value}>{t.label}</option>
						{/each}
					</select>
				</label>
			</div>

			<label class="mt-2 block text-xs font-medium">
				<span class="mb-1 block">Help text</span>
				<input
					type="text"
					bind:value={fields[i].helpText}
					maxlength="500"
					placeholder="Optional guidance for staff"
					class="w-full rounded-md border px-2 py-1.5 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
				/>
			</label>

			{#if hasOptions(field.fieldType)}
				<label class="mt-2 block text-xs font-medium">
					<span class="mb-1 block">Options (one per line)</span>
					<textarea
						rows="3"
						value={getOptionsText(field)}
						oninput={(e) => setOptions(i, (e.target as HTMLTextAreaElement).value)}
						placeholder="Option A&#10;Option B&#10;Option C"
						class="w-full rounded-md border px-2 py-1.5 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
					></textarea>
				</label>
			{/if}

			<div class="mt-2 flex items-center gap-2">
				<label class="flex cursor-pointer items-center gap-1.5 text-xs">
					<input type="checkbox" bind:checked={fields[i].isRequired} class="rounded border-input" />
					Required
				</label>
			</div>
		</div>
	{/each}

	<Button type="button" variant="outline" size="sm" onclick={addField} class="w-full">
		<PlusIcon class="size-4" />
		Add field
	</Button>
</div>
