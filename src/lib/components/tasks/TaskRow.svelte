<script lang="ts">
	import type { TaskStatus, TaskPriority } from '@prisma/client';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import TaskStatusBadge from './TaskStatusBadge.svelte';
	import TaskPriorityBadge from './TaskPriorityBadge.svelte';
	import OverdueBadge from './OverdueBadge.svelte';

	type AssigneeLite = { name: string; photoUrl: string | null };
	type Task = {
		id: string;
		title: string;
		status: TaskStatus;
		priority: TaskPriority;
		dueDate: Date | string | null;
		assignee: AssigneeLite;
		department: { id: string; name: string } | null;
	};

	type Props = { task: Task; layout: 'card' | 'row' };
	let { task, layout }: Props = $props();

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('');
	}

	function fmtDue(d: Date | string | null): string {
		if (!d) return 'No due date';
		const dd = typeof d === 'string' ? new Date(d) : d;
		return dd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

{#if layout === 'card'}
	<a href={`/tasks/${task.id}`} class="block px-4 py-3 hover:bg-accent">
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0 flex-1">
				<div class="truncate font-medium">{task.title}</div>
				<div class="mt-0.5 text-xs text-muted-foreground">
					{fmtDue(task.dueDate)}{task.department ? ` · ${task.department.name}` : ''}
				</div>
			</div>
			<Avatar class="size-7 flex-shrink-0">
				{#if task.assignee.photoUrl}<AvatarImage src={task.assignee.photoUrl} alt="" />{/if}
				<AvatarFallback class="text-[10px]">{initials(task.assignee.name)}</AvatarFallback>
			</Avatar>
		</div>
		<div class="mt-2 flex flex-wrap items-center gap-1.5">
			<TaskStatusBadge status={task.status} />
			<TaskPriorityBadge priority={task.priority} />
			<OverdueBadge dueDate={task.dueDate} status={task.status} />
		</div>
	</a>
{:else}
	<tr class="hover:bg-accent/40">
		<td class="px-4 py-2.5">
			<a href={`/tasks/${task.id}`} class="font-medium hover:underline">{task.title}</a>
			<div class="mt-0.5 text-xs text-muted-foreground">
				{task.department?.name ?? '—'}
			</div>
		</td>
		<td class="px-4 py-2.5">
			<TaskStatusBadge status={task.status} />
		</td>
		<td class="px-4 py-2.5">
			<TaskPriorityBadge priority={task.priority} />
		</td>
		<td class="px-4 py-2.5">
			<div class="flex items-center gap-2">
				<span>{fmtDue(task.dueDate)}</span>
				<OverdueBadge dueDate={task.dueDate} status={task.status} />
			</div>
		</td>
		<td class="px-4 py-2.5">
			<div class="flex items-center gap-2">
				<Avatar class="size-6">
					{#if task.assignee.photoUrl}<AvatarImage src={task.assignee.photoUrl} alt="" />{/if}
					<AvatarFallback class="text-[10px]">{initials(task.assignee.name)}</AvatarFallback>
				</Avatar>
				<span class="text-sm">{task.assignee.name}</span>
			</div>
		</td>
	</tr>
{/if}
