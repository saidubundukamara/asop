import {
	enqueueQueueItem,
	listQueue,
	deleteQueueItem,
	updateQueueItem,
	deleteDraft,
	type QueueRecord
} from './idb-drafts';

// Phase 8 — offline submission queue. Holds report submissions until the
// device is back online, then drains FIFO. Window `online` listener is the
// primary trigger (works on iOS Safari). Service Worker Background Sync
// (`sync` event in service-worker.ts) is an enhancement on Chrome/Android
// that drains even while the tab is closed.

const SUBMIT_PATH = '/reports/new?/submit';

export type DrainResult = { ok: number; failed: number };

export async function enqueueSubmission(input: {
	reportId: string;
	valuesJson: string;
}): Promise<void> {
	await enqueueQueueItem({
		reportId: input.reportId,
		valuesJson: input.valuesJson,
		attemptedAt: Date.now()
	});
}

export async function peekQueue(): Promise<QueueRecord[]> {
	return listQueue();
}

// Success criterion intentionally loose: `?/submit` ends with `redirect(303,
// /reports/[id])` on success. fetch follows redirects by default, so the
// final response status is 200 (or whatever the report detail page returns).
// We accept any non-error response whose final URL lives under /reports/ as
// proof the submission was accepted.
function isSubmitSuccess(res: Response): boolean {
	if (res.status >= 400) return false;
	try {
		const url = new URL(res.url);
		return url.pathname.startsWith('/reports/') && !url.pathname.startsWith('/reports/new');
	} catch {
		return false;
	}
}

type FetchFn = typeof fetch;

export async function drainQueue(fetchImpl: FetchFn = fetch): Promise<DrainResult> {
	let ok = 0;
	let failed = 0;

	// listQueue returns records in autoIncrement order → FIFO.
	const items = await listQueue();
	for (const item of items) {
		if (item.id === undefined) continue;

		const body = new FormData();
		body.append('reportId', item.reportId);
		body.append('valuesJson', item.valuesJson);

		let res: Response;
		try {
			res = await fetchImpl(SUBMIT_PATH, { method: 'POST', body });
		} catch (err) {
			failed++;
			await updateQueueItem({
				...item,
				lastError: err instanceof Error ? err.message : 'network error',
				attemptedAt: Date.now()
			});
			// Network down — stop draining; the next `online` event will retry.
			break;
		}

		if (isSubmitSuccess(res)) {
			await deleteQueueItem(item.id);
			await deleteDraft(item.reportId).catch(() => {});
			ok++;
			continue;
		}

		// 400 (validation) means the user has unresolved required-field errors —
		// retrying won't help. Mark it and stop draining so we don't burn
		// through more items in the same broken state.
		if (res.status === 400) {
			await updateQueueItem({
				...item,
				lastError: 'validation',
				attemptedAt: Date.now()
			});
			failed++;
			break;
		}

		// Other 4xx / 5xx — record and stop. Could be a transient server issue
		// or a session expiry; either way we don't want to mass-fail the queue.
		await updateQueueItem({
			...item,
			lastError: `http ${res.status}`,
			attemptedAt: Date.now()
		});
		failed++;
		break;
	}

	return { ok, failed };
}
