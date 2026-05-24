<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import UsersIcon from '@lucide/svelte/icons/users';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UndoIcon from '@lucide/svelte/icons/undo-2';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import TaskStatusBadge from '$lib/components/tasks/TaskStatusBadge.svelte';
	import TaskPriorityBadge from '$lib/components/tasks/TaskPriorityBadge.svelte';
	import OverdueBadge from '$lib/components/tasks/OverdueBadge.svelte';
	import StatusActionButtons from '$lib/components/tasks/StatusActionButtons.svelte';
	import CommentThread from '$lib/components/tasks/CommentThread.svelte';
	import CommentForm from '$lib/components/tasks/CommentForm.svelte';
	import FileDropzone from '$lib/components/forms/FileDropzone.svelte';
	import EditTaskSheet from '$lib/components/tasks/EditTaskSheet.svelte';
	import ReassignSheet from '$lib/components/tasks/ReassignSheet.svelte';
	import DeleteTaskDialog from '$lib/components/tasks/DeleteTaskDialog.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const editOpen = $derived(data.canEdit && page.url.searchParams.get('action') === 'edit');
	const reassignOpen = $derived(
		data.canReassign && page.url.searchParams.get('action') === 'reassign'
	);
	let deleteOpen = $state(false);
	let restoreBusy = $state(false);

	function openParam(action: string) {
		const url = new URL(page.url);
		url.searchParams.set('action', action);
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: false, noScroll: true });
	}

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('');
	}

	function fmt(dt: Date | string | null): string {
		if (!dt) return '—';
		const d = typeof dt === 'string' ? new Date(dt) : dt;
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:head><title>{data.task.title} · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-10">
	<a
		href="/tasks"
		class="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeftIcon class="mr-1 size-4" /> Back to tasks
	</a>

	{#if data.task.deletedAt}
		<div
			class="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
		>
			This task is in trash. {#if data.canRestore}Restore it below.{/if}
		</div>
	{/if}

	<header class="mb-4 flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">{data.task.title}</h1>
			<div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
				<TaskStatusBadge status={data.task.status} />
				<TaskPriorityBadge priority={data.task.priority} />
				<OverdueBadge dueDate={data.task.dueDate} status={data.task.status} />
				{#if data.task.template}
					<span class="text-muted-foreground">via {data.task.template.name}</span>
				{/if}
			</div>
		</div>
		<div class="flex gap-2">
			{#if data.canEdit}
				<Button variant="outline" size="sm" onclick={() => openParam('edit')}>
					<PencilIcon class="size-4" />
					<span class="hidden sm:inline">Edit</span>
				</Button>
			{/if}
			{#if data.canReassign}
				<Button variant="outline" size="sm" onclick={() => openParam('reassign')}>
					<UsersIcon class="size-4" />
					<span class="hidden sm:inline">Reassign</span>
				</Button>
			{/if}
			{#if data.canDelete && !data.task.deletedAt}
				<Button variant="outline" size="sm" onclick={() => (deleteOpen = true)}>
					<Trash2Icon class="size-4 text-destructive" />
				</Button>
			{/if}
			{#if data.canRestore}
				<form
					method="POST"
					action="?/restore"
					use:enhance={() => {
						restoreBusy = true;
						return async ({ result, update }) => {
							restoreBusy = false;
							await update({ reset: false });
							if (result.type === 'success') toast.success('Task restored');
							else toast.error('Could not restore');
						};
					}}
				>
					<Button type="submit" variant="default" size="sm" disabled={restoreBusy}>
						<UndoIcon class="size-4" /> Restore
					</Button>
				</form>
			{/if}
		</div>
	</header>

	<div class="grid gap-6">
		<Card>
			<CardHeader>
				<CardTitle class="text-base">Status</CardTitle>
			</CardHeader>
			<CardContent class="grid gap-4">
				{#if data.canUpdateStatus}
					<StatusActionButtons allowedTransitions={data.allowedTransitions} />
				{:else}
					<p class="text-sm text-muted-foreground">You don't have permission to change status.</p>
				{/if}
				<dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
					<div>
						<dt class="text-xs text-muted-foreground">Assignee</dt>
						<dd class="mt-0.5 flex items-center gap-1.5">
							<Avatar class="size-5">
								{#if data.task.assignee.photoUrl}<AvatarImage
										src={data.task.assignee.photoUrl}
										alt=""
									/>{/if}
								<AvatarFallback class="text-[10px]">
									{initials(data.task.assignee.name)}
								</AvatarFallback>
							</Avatar>
							{data.task.assignee.name}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Assigner</dt>
						<dd class="mt-0.5">{data.task.assigner?.name ?? '—'}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Due</dt>
						<dd class="mt-0.5">{fmt(data.task.dueDate)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted-foreground">Program</dt>
						<dd class="mt-0.5">{data.task.department?.name ?? '—'}</dd>
					</div>
				</dl>
			</CardContent>
		</Card>

		{#if data.task.description}
			<Card>
				<CardHeader><CardTitle class="text-base">Details</CardTitle></CardHeader>
				<CardContent>
					<!-- description is sanitized server-side via sanitizeRichText() before persistence -->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="prose prose-sm max-w-none">{@html data.task.description}</div>
				</CardContent>
			</Card>
		{/if}

		<Card>
			<CardHeader><CardTitle class="text-base">Attachments</CardTitle></CardHeader>
			<CardContent>
				<FileDropzone
					ownerType="task"
					ownerId={data.task.id}
					folder="task-attachments"
					existingAttachments={data.attachments}
					canDelete={data.canDeleteAttachment}
					readonly={!!data.task.deletedAt || data.task.status === 'completed'}
				/>
			</CardContent>
		</Card>

		<Card>
			<CardHeader><CardTitle class="text-base">Comments</CardTitle></CardHeader>
			<CardContent class="grid gap-4">
				{#if data.canComment}
					<CommentForm />
				{/if}
				<CommentThread
					comments={data.task.comments}
					commentEditFlags={data.commentEditFlags}
					canDeleteAnyComment={data.canDeleteAnyComment}
				/>
			</CardContent>
		</Card>

		<Card>
			<CardHeader><CardTitle class="text-base">History</CardTitle></CardHeader>
			<CardContent>
				<ol class="space-y-1.5 text-sm">
					{#each data.task.statusEvents as ev (ev.id)}
						<li class="flex flex-wrap items-baseline gap-1.5 text-muted-foreground">
							<span class="text-foreground">
								{ev.fromStatus ? `${ev.fromStatus} → ${ev.toStatus}` : `created (${ev.toStatus})`}
							</span>
							<span>·</span>
							<span>{ev.actor?.name ?? '—'}</span>
							<span>·</span>
							<span>{fmt(ev.at)}</span>
							{#if ev.note}
								<span class="block w-full pl-3 italic">{ev.note}</span>
							{/if}
						</li>
					{/each}
				</ol>
			</CardContent>
		</Card>
	</div>
</div>

{#if data.canEdit}
	<EditTaskSheet
		open={editOpen}
		task={{
			title: data.task.title,
			description: data.task.description,
			priority: data.task.priority,
			dueDate: data.task.dueDate,
			departmentId: data.task.departmentId
		}}
		departments={data.departments}
	/>
{/if}

{#if data.canReassign}
	<ReassignSheet
		open={reassignOpen}
		currentAssigneeId={data.task.assigneeId}
		assignees={data.assigneeOptions}
	/>
{/if}

{#if data.canDelete}
	<DeleteTaskDialog
		open={deleteOpen}
		onOpenChange={(o) => (deleteOpen = o)}
		taskTitle={data.task.title}
	/>
{/if}
