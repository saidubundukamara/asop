<script lang="ts">
	import type { TaskStatus } from '@prisma/client';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';

	type Props = { dueDate: Date | string | null; status: TaskStatus };
	let { dueDate, status }: Props = $props();

	// Tasks in terminal states are never "overdue" — they're done.
	const TERMINAL: TaskStatus[] = ['completed', 'cancelled'];

	const daysOverdue = $derived.by(() => {
		if (!dueDate) return null;
		if (TERMINAL.includes(status)) return null;
		const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
		const diffMs = Date.now() - d.getTime();
		if (diffMs <= 0) return null;
		return Math.floor(diffMs / (1000 * 60 * 60 * 24));
	});
</script>

{#if daysOverdue !== null}
	<span
		class="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
	>
		<AlertTriangleIcon class="size-3" />
		Overdue · {daysOverdue}d
	</span>
{/if}
