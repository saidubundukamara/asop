<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import TemplatePickerSheet from '$lib/components/reports/TemplatePickerSheet.svelte';
	import DynamicReportForm from '$lib/components/reports/DynamicReportForm.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedTemplate = $state(data.preselected);
	let reportId = $state<string | null>(null);
	let fieldValues = $state<Record<string, unknown>>({});
	let lastSaved = $state<Date | null>(null);
	let submitting = $state(false);
	let saving = $state(false);

	// On first create action success, store the reportId for subsequent autosaves.
	$effect(() => {
		if (
			form?.ok &&
			form.data &&
			typeof form.data === 'object' &&
			'reportId' in form.data &&
			!reportId
		) {
			reportId = (form.data as { reportId: string }).reportId;
		}
	});

	// Auto-save every 10s when a draft exists and form has values.
	$effect(() => {
		if (!reportId) return;
		const timer = setInterval(async () => {
			if (saving) return;
			saving = true;
			try {
				const fd = new FormData();
				fd.set('reportId', reportId!);
				fd.set('valuesJson', JSON.stringify(serializeValues(fieldValues)));
				const res = await fetch('?/autosave', { method: 'POST', body: fd });
				if (res.ok) lastSaved = new Date();
			} catch {
				// Silent — autosave failures don't interrupt the user.
			} finally {
				saving = false;
			}
		}, 10_000);
		return () => clearInterval(timer);
	});

	async function saveDraft() {
		if (!selectedTemplate || saving) return;
		saving = true;
		try {
			const fd = new FormData();
			fd.set('templateId', selectedTemplate.id);
			fd.set('valuesJson', JSON.stringify(serializeValues(fieldValues)));
			if (data.taskId) fd.set('taskId', data.taskId);
			const res = await fetch('?/create', { method: 'POST', body: fd });
			if (res.ok) {
				const json = await res.json().catch(() => null);
				// SvelteKit action response wraps data in { type: 'success', data: ... }
				const rid = json?.data?.reportId;
				if (rid) {
					reportId = rid;
					lastSaved = new Date();
					toast.success('Draft saved');
				}
			}
		} catch {
			toast.error('Could not save draft');
		} finally {
			saving = false;
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

	const pickerOpen = $derived(!selectedTemplate);
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
		<!-- Step 2: fill the form -->
		<form
			method="POST"
			action="?/submit"
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					submitting = false;
					await update({ reset: false });
					if (result.type === 'failure') {
						toast.error('Please fill in all required fields');
					}
				};
			}}
		>
			<input type="hidden" name="reportId" value={reportId ?? ''} />
			<input type="hidden" name="valuesJson" value={JSON.stringify(serializeValues(fieldValues))} />
			{#if data.taskId}
				<input type="hidden" name="taskId" value={data.taskId} />
			{/if}

			<DynamicReportForm
				fields={selectedTemplate.fields}
				bind:values={fieldValues}
				issues={form?.ok === false ? (form.issues ?? {}) : {}}
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

<!-- Template picker (step 1) — shown when no template is selected -->
<TemplatePickerSheet
	open={pickerOpen}
	templates={data.templates}
	onselect={(tpl) => {
		selectedTemplate = tpl;
	}}
/>
