<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import ReportStatusBadge from '$lib/components/reports/ReportStatusBadge.svelte';
	import DynamicReportForm from '$lib/components/reports/DynamicReportForm.svelte';
	import ReviewActions from '$lib/components/reports/ReviewActions.svelte';
	import CommentThread from '$lib/components/reports/CommentThread.svelte';
	import CommentForm from '$lib/components/reports/CommentForm.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const report = $derived(data.report);
	const caps = $derived(data.capabilities);

	let reopening = $state(false);
	let deleting = $state(false);

	$effect(() => {
		if (form?.ok && form.data && typeof form.data === 'object' && 'status' in form.data) {
			const status = (form.data as { status: string }).status;
			toast.success(status === 'approved' ? 'Report approved' : 'Revision requested');
		}
	});
</script>

<svelte:head><title>{report.template.name} · Reports · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 md:py-10">
	<!-- Header -->
	<div class="mb-1">
		<a href="/reports" class="text-sm text-muted-foreground hover:underline">← Reports</a>
	</div>
	<div class="mb-6 flex flex-wrap items-start justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold tracking-tight">{report.template.name}</h1>
			<div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<ReportStatusBadge status={report.status} />
				<span>v{report.templateVersion}</span>
				<span>by {report.author.name}</span>
				{#if report.submittedAt}
					<span>· submitted {new Date(report.submittedAt).toLocaleDateString()}</span>
				{/if}
				{#if report.reviewer}
					<span>· reviewer: {report.reviewer.name}</span>
				{/if}
			</div>
		</div>
		<div class="flex gap-2">
			{#if caps.canReopen}
				<form
					method="POST"
					action="?/reopen"
					use:enhance={() => {
						reopening = true;
						return async ({ result, update }) => {
							reopening = false;
							await update({ reset: false });
							if (result.type === 'success') toast.success('Report reopened');
							else toast.error('Could not reopen');
						};
					}}
				>
					<input type="hidden" name="reportId" value={report.id} />
					<Button variant="outline" size="sm" type="submit" disabled={reopening}>Reopen</Button>
				</form>
			{/if}
			{#if caps.canDelete}
				<form
					method="POST"
					action="?/delete"
					use:enhance={({ cancel }) => {
						if (!confirm('Delete this report? This cannot be undone.')) {
							cancel();
							return;
						}
						deleting = true;
						return async ({ result, update }) => {
							deleting = false;
							if (result.type !== 'redirect') {
								await update({ reset: false });
								toast.error('Could not delete report');
							}
						};
					}}
				>
					<input type="hidden" name="reportId" value={report.id} />
					<Button variant="destructive" size="sm" type="submit" disabled={deleting}>
						{deleting ? 'Deleting…' : 'Delete'}
					</Button>
				</form>
			{/if}
		</div>
	</div>

	{#if report.task}
		<div class="mb-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
			<span class="text-muted-foreground">Linked task: </span>
			<a href="/tasks/{report.task.id}" class="font-medium hover:underline">{report.task.title}</a>
		</div>
	{/if}

	<!-- Field values (read-only) -->
	<div class="mb-8 rounded-lg border p-4">
		<DynamicReportForm
			fields={report.template.fields}
			values={report.valuesByFieldId}
			issues={{}}
			readonly={true}
		/>
	</div>

	<!-- Review actions (for reviewers on submitted/under_review reports) -->
	{#if caps.canReview && (report.status === 'submitted' || report.status === 'under_review')}
		<ReviewActions reportId={report.id} actionBase="?/" />
	{/if}

	<!-- Comments -->
	<section class="mt-8">
		<h2 class="mb-3 text-base font-semibold">Comments</h2>
		<CommentThread comments={report.comments} />
		{#if caps.canComment}
			<CommentForm reportId={report.id} actionPath="?/addComment" />
		{/if}
	</section>
</div>
