<script lang="ts">
	import ReportStatusBadge from './ReportStatusBadge.svelte';

	type Report = {
		id: string;
		status: string;
		templateVersion: number;
		submittedAt: Date | null;
		updatedAt: Date;
		template: { id: string; name: string };
		author: { id: string; name: string; photoUrl: string | null };
		reviewer: { id: string; name: string } | null;
	};

	let { reports }: { reports: Report[] } = $props();
</script>

{#if reports.length === 0}
	<div class="rounded-lg border border-dashed p-10 text-center">
		<p class="text-sm text-muted-foreground">No reports found.</p>
		<a href="/reports/new" class="mt-2 inline-block text-sm font-medium hover:underline">
			Submit a report →
		</a>
	</div>
{:else}
	<ul class="divide-y rounded-lg border">
		{#each reports as report (report.id)}
			<li class="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30">
				<div class="min-w-0 flex-1">
					<a href="/reports/{report.id}" class="block font-medium hover:underline">
						{report.template.name}
						<span class="ml-1 text-xs font-normal text-muted-foreground"
							>v{report.templateVersion}</span
						>
					</a>
					<div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<ReportStatusBadge status={report.status} />
						<span>by {report.author.name}</span>
						{#if report.submittedAt}
							<span>· {new Date(report.submittedAt).toLocaleDateString()}</span>
						{:else}
							<span>· edited {new Date(report.updatedAt).toLocaleDateString()}</span>
						{/if}
						{#if report.reviewer}
							<span>· {report.reviewer.name}</span>
						{/if}
					</div>
				</div>
				<a
					href="/reports/{report.id}"
					class="shrink-0 rounded-md border px-3 py-1 text-xs hover:bg-muted"
				>
					View
				</a>
			</li>
		{/each}
	</ul>
{/if}
