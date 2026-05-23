<script lang="ts">
	import type { TaskStatus, TaskPriority } from '@prisma/client';
	import TaskRow from './TaskRow.svelte';

	type Task = {
		id: string;
		title: string;
		status: TaskStatus;
		priority: TaskPriority;
		dueDate: Date | string | null;
		assignee: { id: string; name: string; photoUrl: string | null };
		department: { id: string; name: string } | null;
	};

	type Props = { tasks: Task[] };
	let { tasks }: Props = $props();
</script>

{#if tasks.length === 0}
	<div class="rounded-lg border border-dashed p-10 text-center">
		<p class="text-sm text-muted-foreground">No tasks match these filters.</p>
	</div>
{:else}
	<!-- Mobile: card list -->
	<ul class="divide-y rounded-lg border md:hidden">
		{#each tasks as t (t.id)}
			<li><TaskRow task={t} layout="card" /></li>
		{/each}
	</ul>

	<!-- Desktop: table -->
	<div class="hidden overflow-hidden rounded-lg border md:block">
		<table class="w-full text-sm">
			<thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
				<tr>
					<th class="px-4 py-2.5">Title</th>
					<th class="px-4 py-2.5">Status</th>
					<th class="px-4 py-2.5">Priority</th>
					<th class="px-4 py-2.5">Due</th>
					<th class="px-4 py-2.5">Assignee</th>
				</tr>
			</thead>
			<tbody class="divide-y">
				{#each tasks as t (t.id)}
					<TaskRow task={t} layout="row" />
				{/each}
			</tbody>
		</table>
	</div>
{/if}
