<script lang="ts">
	import type { TaskStatus } from '@prisma/client';

	type Props = { status: TaskStatus };
	let { status }: Props = $props();

	const LABEL: Record<TaskStatus, string> = {
		assigned: 'Assigned',
		in_progress: 'In progress',
		submitted: 'Submitted',
		completed: 'Completed',
		blocked: 'Blocked',
		cancelled: 'Cancelled'
	};

	// Color choices kept in one place so designers can re-skin without grep.
	const CLASS: Record<TaskStatus, string> = {
		assigned: 'bg-muted text-muted-foreground',
		in_progress: 'bg-sky-100 text-sky-700',
		submitted: 'bg-amber-100 text-amber-800',
		completed: 'bg-emerald-100 text-emerald-700',
		blocked: 'bg-destructive/10 text-destructive',
		cancelled: 'bg-muted text-muted-foreground line-through'
	};
</script>

<span class="rounded-full px-2 py-0.5 text-xs font-medium {CLASS[status]}">{LABEL[status]}</span>
