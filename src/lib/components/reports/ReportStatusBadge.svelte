<script lang="ts">
	let { status }: { status: string } = $props();

	const config: Record<string, { label: string; class: string }> = {
		draft: { label: 'Draft', class: 'bg-muted text-muted-foreground' },
		submitted: {
			label: 'Submitted',
			class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
		},
		under_review: {
			label: 'Under review',
			class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
		},
		approved: {
			label: 'Approved',
			class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
		},
		needs_revision: {
			label: 'Needs revision',
			class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
		}
	};

	const badge = $derived(
		config[status] ?? { label: status, class: 'bg-muted text-muted-foreground' }
	);
</script>

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {badge.class}">
	{badge.label}
</span>
