<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { deserialize } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import type { ActionResult } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import TemplatePickerSheet from '$lib/components/reports/TemplatePickerSheet.svelte';
	import DynamicReportForm from '$lib/components/reports/DynamicReportForm.svelte';
	import { saveDraft as idbSaveDraft, getDraft, deleteDraft } from '$lib/client/idb-drafts';
	import { enqueueSubmission } from '$lib/client/submission-queue';
	import type { PageData, ActionData } from './$types';
	import { untrack } from 'svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedTemplate = $state(untrack(() => data.preselected));
	let reportId = $state<string | null>(null);
	let fieldValues = $state<Record<string, unknown>>({});
	let lastSaved = $state<Date | null>(null);
	let submitting = $state(false);
	let saving = $state(false);
	let issues = $state<Record<string, string[]>>({});

	// Restore IDB draft if we have one for the current reportId (e.g. user
	// reopened the page after closing the tab while offline).
	$effect(() => {
		if (!reportId) return;
		void getDraft(reportId).then((d) => {
			if (!d) return;
			try {
				const parsed = JSON.parse(d.valuesJson) as Array<{ fieldId: string; [k: string]: unknown }>;
				const restored: Record<string, unknown> = {};
				for (const entry of parsed) {
					restored[entry.fieldId] = hydrateValue(entry);
				}
				fieldValues = restored;
				lastSaved = new Date(d.updatedAt);
			} catch {
				/* ignore corrupted draft */
			}
		});
	});

	// 10s autosave: IDB always, server best-effort when online.
	$effect(() => {
		if (!reportId || !selectedTemplate) return;
		const tplId = selectedTemplate.id;
		const rid = reportId;
		const timer = setInterval(async () => {
			if (saving) return;
			saving = true;
			try {
				const valuesJson = JSON.stringify(serializeValues(fieldValues));
				await idbSaveDraft(rid, tplId, valuesJson);
				lastSaved = new Date();
				if (navigator.onLine) {
					const fd = new FormData();
					fd.set('reportId', rid);
					fd.set('valuesJson', valuesJson);
					fetch('?/autosave', { method: 'POST', body: fd }).catch(() => {});
				}
			} finally {
				saving = false;
			}
		}, 10_000);
		return () => clearInterval(timer);
	});

	async function saveDraft() {
		if (!selectedTemplate || saving) return;
		if (!navigator.onLine) {
			toast.error('Connect to the internet to start a new draft.');
			return;
		}
		saving = true;
		try {
			const fd = new FormData();
			fd.set('templateId', selectedTemplate.id);
			fd.set('valuesJson', JSON.stringify(serializeValues(fieldValues)));
			if (data.taskId) fd.set('taskId', data.taskId);
			const res = await fetch('?/create', { method: 'POST', body: fd });
			if (!res.ok) throw new Error('create failed');
			const parsed = deserialize(await res.text()) as ActionResult<{
				data?: { reportId: string };
			}>;
			const rid = parsed.type === 'success' ? (parsed.data?.data?.reportId ?? null) : null;
			if (!rid) throw new Error('no reportId in response');
			reportId = rid;
			lastSaved = new Date();
			await idbSaveDraft(rid, selectedTemplate.id, JSON.stringify(serializeValues(fieldValues)));
			toast.success('Draft saved');
		} catch {
			toast.error('Could not save draft');
		} finally {
			saving = false;
		}
	}

	async function submit(e: Event) {
		e.preventDefault();
		if (!selectedTemplate || submitting) return;
		if (!reportId) {
			// First we need a server-side draft to attach the submission to. If
			// the user filled the form without saving first and is offline, we
			// can't create the draft — guide them.
			if (!navigator.onLine) {
				toast.error('Connect to the internet to start this submission.');
				return;
			}
			await saveDraft();
			if (!reportId) return;
		}
		submitting = true;
		const valuesJson = JSON.stringify(serializeValues(fieldValues));

		if (!navigator.onLine) {
			try {
				await idbSaveDraft(reportId, selectedTemplate.id, valuesJson);
				await enqueueSubmission({ reportId, valuesJson });
				// Best-effort Background Sync registration. Fails silently on iOS;
				// the window `online` drainer is the iOS-safe primary.
				try {
					const reg = await navigator.serviceWorker.ready;
					const swr = reg as ServiceWorkerRegistration & {
						sync?: { register: (tag: string) => Promise<void> };
					};
					await swr.sync?.register('report-submit');
				} catch {
					/* ignore */
				}
				toast.success("Submission queued — we'll send it when you're back online.");
				void goto(resolve('/reports'));
			} catch {
				toast.error('Could not queue submission.');
			} finally {
				submitting = false;
			}
			return;
		}

		try {
			const fd = new FormData();
			fd.set('reportId', reportId);
			fd.set('valuesJson', valuesJson);
			const res = await fetch('?/submit', { method: 'POST', body: fd });
			const finalUrl = new URL(res.url);
			const finalPath = finalUrl.pathname;
			// ?/submit ends with `redirect(303, /reports/[id])` on success; fetch
			// follows that automatically, so a successful submission lands on the
			// report detail page.
			if (res.ok && finalPath.startsWith('/reports/') && !finalPath.startsWith('/reports/new')) {
				await deleteDraft(reportId).catch(() => {});
				// Dynamic /reports/[id] path can't be expressed in resolve()'s route
				// union; matches the existing convention in TaskFilters.svelte.
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				void goto(finalUrl);
				return;
			}
			// Validation failure shape: ActionResult.failure with { issues }.
			const parsed = deserialize(await res.text()) as ActionResult<
				never,
				{ issues?: Record<string, string[]> }
			>;
			if (parsed.type === 'failure' && parsed.data?.issues) {
				issues = parsed.data.issues;
				toast.error('Please fill in all required fields');
			} else {
				toast.error('Submission failed. Please try again.');
			}
		} catch {
			// Network died mid-submit — queue it and let the drainer retry.
			try {
				await enqueueSubmission({ reportId, valuesJson });
				toast.success("Submission queued — we'll send it when you're back online.");
				void goto(resolve('/reports'));
			} catch {
				toast.error('Could not queue submission.');
			}
		} finally {
			submitting = false;
		}
	}

	function serializeValues(values: Record<string, unknown>) {
		return Object.entries(values).map(([fieldId, val]) => ({ fieldId, ...flattenValue(val) }));
	}

	function flattenValue(val: unknown): Record<string, unknown> {
		if (val === null || val === undefined) return {};
		if (typeof val === 'string') return { valueText: val };
		if (typeof val === 'number') return { valueNumber: String(val) };
		if (val instanceof Date) return { valueDate: val.toISOString() };
		if (Array.isArray(val) || typeof val === 'object') return { valueJson: JSON.stringify(val) };
		return { valueText: String(val) };
	}

	function hydrateValue(entry: { [k: string]: unknown }): unknown {
		if ('valueText' in entry && entry.valueText !== undefined && entry.valueText !== null)
			return entry.valueText;
		if ('valueNumber' in entry && entry.valueNumber !== undefined && entry.valueNumber !== null)
			return entry.valueNumber;
		if ('valueDate' in entry && entry.valueDate !== undefined && entry.valueDate !== null)
			return entry.valueDate;
		if ('valueJson' in entry && entry.valueJson !== undefined && entry.valueJson !== null)
			return entry.valueJson;
		return '';
	}

	const pickerOpen = $derived(!selectedTemplate);
	const formIssues = $derived(
		Object.keys(issues).length > 0 ? issues : form && form.ok === false ? (form.issues ?? {}) : {}
	);
</script>

<svelte:head><title>Submit report · ADSAT Ops</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 md:py-10">
	<div class="mb-6">
		<a href="/reports" class="text-sm text-muted-foreground hover:underline">← Reports</a>
		<h1 class="mt-2 text-2xl font-semibold tracking-tight">Submit a report</h1>
		{#if selectedTemplate}
			<div class="mt-1 flex items-center gap-2">
				<span class="text-sm text-muted-foreground">{selectedTemplate.name}</span>
				<button
					type="button"
					class="text-xs text-muted-foreground underline"
					onclick={() => {
						selectedTemplate = null;
						reportId = null;
						fieldValues = {};
					}}
				>
					Change
				</button>
			</div>
			{#if lastSaved}
				<p class="mt-0.5 text-xs text-muted-foreground">
					Draft saved {lastSaved.toLocaleTimeString()}
				</p>
			{/if}
		{/if}
	</div>

	{#if selectedTemplate}
		<form onsubmit={submit}>
			{#if data.taskId}
				<input type="hidden" name="taskId" value={data.taskId} />
			{/if}

			<DynamicReportForm
				fields={selectedTemplate.fields}
				bind:values={fieldValues}
				issues={formIssues}
				readonly={false}
			/>

			<div class="mt-6 flex justify-end gap-2">
				<a href="/reports"><Button variant="outline" type="button">Cancel</Button></a>
				{#if !reportId}
					<Button type="button" variant="outline" disabled={saving} onclick={saveDraft}>
						{saving ? 'Saving…' : 'Save draft'}
					</Button>
				{/if}
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Submitting…' : 'Submit report'}
				</Button>
			</div>
		</form>
	{/if}
</div>

<TemplatePickerSheet
	open={pickerOpen}
	templates={data.templates}
	onselect={(tpl) => {
		selectedTemplate = tpl;
	}}
/>
