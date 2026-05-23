<script lang="ts">
	import type { TaskPriority } from '@prisma/client';

	type Props = { priority: TaskPriority };
	let { priority }: Props = $props();

	const LABEL: Record<TaskPriority, string> = {
		low: 'Low',
		medium: 'Medium',
		high: 'High'
	};

	const CLASS: Record<TaskPriority, string> = {
		low: 'border-muted text-muted-foreground',
		medium: 'border-foreground/20 text-foreground/80',
		high: 'border-destructive/50 text-destructive'
	};
</script>

<span class="rounded-full border px-2 py-0.5 text-xs font-medium {CLASS[priority]}">
	{LABEL[priority]}
</span>
