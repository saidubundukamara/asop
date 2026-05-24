<script lang="ts">
	let {
		fieldId,
		label,
		helpText = '',
		isRequired = false,
		value = $bindable<{ lat: number; lng: number } | null>(null),
		readonly = false,
		error = ''
	}: {
		fieldId: string;
		label: string;
		helpText?: string;
		isRequired?: boolean;
		value?: { lat: number; lng: number } | null;
		readonly?: boolean;
		error?: string;
	} = $props();

	let capturing = $state(false);
	let geoError = $state('');

	async function capture() {
		if (!navigator.geolocation) {
			geoError = 'Geolocation is not supported on this device.';
			return;
		}
		capturing = true;
		geoError = '';
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
				capturing = false;
			},
			(err) => {
				geoError = err.message ?? 'Could not get location.';
				capturing = false;
			},
			{ timeout: 10_000 }
		);
	}
</script>

<div id={fieldId} class="space-y-1">
	<span class="block text-sm font-medium">
		{label}{#if isRequired}<span class="ml-0.5 text-destructive">*</span>{/if}
	</span>
	{#if helpText}<p class="text-xs text-muted-foreground">{helpText}</p>{/if}
	{#if readonly}
		<p class="min-h-[2rem] rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
			{value ? `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}` : '—'}
		</p>
	{:else}
		<div class="rounded-md border p-3" class:border-destructive={!!error}>
			{#if value}
				<p class="mb-2 font-mono text-sm">
					{value.lat.toFixed(6)}, {value.lng.toFixed(6)}
				</p>
			{/if}
			<button
				type="button"
				onclick={capture}
				disabled={capturing}
				class="rounded-md bg-muted px-3 py-1.5 text-sm hover:bg-muted/80 disabled:opacity-50"
			>
				{capturing ? 'Getting location…' : value ? 'Update location' : 'Capture location'}
			</button>
			{#if geoError}<p class="mt-1 text-xs text-destructive">{geoError}</p>{/if}
		</div>
		{#if error}<p class="text-xs text-destructive">{error}</p>{/if}
	{/if}
</div>
