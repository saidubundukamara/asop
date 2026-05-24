import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
	enqueueQueueItem,
	listQueue,
	saveDraft,
	getDraft,
	getDB,
	STORE_DRAFTS,
	STORE_QUEUE
} from './idb-drafts';
import { drainQueue } from './submission-queue';

beforeEach(async () => {
	const db = await getDB();
	await new Promise<void>((resolve, reject) => {
		const t = db.transaction([STORE_DRAFTS, STORE_QUEUE], 'readwrite');
		t.objectStore(STORE_DRAFTS).clear();
		t.objectStore(STORE_QUEUE).clear();
		t.oncomplete = () => resolve();
		t.onerror = () => reject(t.error);
	});
});

function mockResponse(opts: { status?: number; url?: string }): Response {
	const r = new Response(null, { status: opts.status ?? 200 });
	// `url` is read-only on Response — shim it for the success-criterion check
	// in drainQueue (we assert `final URL starts with /reports/`).
	Object.defineProperty(r, 'url', { value: opts.url ?? '', configurable: true });
	return r;
}

describe('drainQueue', () => {
	it('returns {ok:0, failed:0} when empty', async () => {
		const fetchMock = vi.fn();
		const result = await drainQueue(fetchMock as unknown as typeof fetch);
		expect(result).toEqual({ ok: 0, failed: 0 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('drains two successful items and deletes their drafts', async () => {
		await saveDraft('r1', 't1', '[]');
		await saveDraft('r2', 't1', '[]');
		await enqueueQueueItem({ reportId: 'r1', valuesJson: '[]', attemptedAt: 0 });
		await enqueueQueueItem({ reportId: 'r2', valuesJson: '[]', attemptedAt: 0 });

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(mockResponse({ status: 200, url: 'http://x/reports/abc' }))
			.mockResolvedValueOnce(mockResponse({ status: 200, url: 'http://x/reports/def' }));

		const result = await drainQueue(fetchMock as unknown as typeof fetch);
		expect(result).toEqual({ ok: 2, failed: 0 });
		expect(await listQueue()).toHaveLength(0);
		expect(await getDraft('r1')).toBeNull();
		expect(await getDraft('r2')).toBeNull();
	});

	it('preserves FIFO when first succeeds and second 500s', async () => {
		await enqueueQueueItem({ reportId: 'r1', valuesJson: '[]', attemptedAt: 0 });
		await enqueueQueueItem({ reportId: 'r2', valuesJson: '[]', attemptedAt: 0 });

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(mockResponse({ status: 200, url: 'http://x/reports/abc' }))
			.mockResolvedValueOnce(mockResponse({ status: 500, url: 'http://x/reports/new' }));

		const result = await drainQueue(fetchMock as unknown as typeof fetch);
		expect(result).toEqual({ ok: 1, failed: 1 });
		const remaining = await listQueue();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].reportId).toBe('r2');
		expect(remaining[0].lastError).toBe('http 500');
	});

	it('preserves the queued item when fetch rejects', async () => {
		await enqueueQueueItem({ reportId: 'r1', valuesJson: '[]', attemptedAt: 0 });
		const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'));
		const result = await drainQueue(fetchMock as unknown as typeof fetch);
		expect(result).toEqual({ ok: 0, failed: 1 });
		const remaining = await listQueue();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].lastError).toBe('offline');
	});

	it('marks 400 as validation and stops draining', async () => {
		await enqueueQueueItem({ reportId: 'r1', valuesJson: '[]', attemptedAt: 0 });
		await enqueueQueueItem({ reportId: 'r2', valuesJson: '[]', attemptedAt: 0 });

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(mockResponse({ status: 400, url: 'http://x/reports/new' }));

		const result = await drainQueue(fetchMock as unknown as typeof fetch);
		expect(result).toEqual({ ok: 0, failed: 1 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const remaining = await listQueue();
		expect(remaining).toHaveLength(2);
		expect(remaining[0].lastError).toBe('validation');
	});

	it('does not treat /reports/new as a successful submission target', async () => {
		await enqueueQueueItem({ reportId: 'r1', valuesJson: '[]', attemptedAt: 0 });
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(mockResponse({ status: 200, url: 'http://x/reports/new' }));
		const result = await drainQueue(fetchMock as unknown as typeof fetch);
		expect(result.ok).toBe(0);
		expect(result.failed).toBe(1);
		expect(await listQueue()).toHaveLength(1);
	});
});
