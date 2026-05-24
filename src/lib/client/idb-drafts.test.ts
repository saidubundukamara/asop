import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
	saveDraft,
	getDraft,
	deleteDraft,
	listDrafts,
	enqueueQueueItem,
	listQueue,
	deleteQueueItem,
	getDB,
	STORE_DRAFTS,
	STORE_QUEUE
} from './idb-drafts';

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

describe('idb-drafts — drafts store', () => {
	it('round-trips a draft', async () => {
		await saveDraft('r1', 't1', '[{"fieldId":"a","valueText":"hi"}]');
		const got = await getDraft('r1');
		expect(got).not.toBeNull();
		expect(got?.reportId).toBe('r1');
		expect(got?.templateId).toBe('t1');
		expect(got?.valuesJson).toBe('[{"fieldId":"a","valueText":"hi"}]');
		expect(typeof got?.updatedAt).toBe('number');
	});

	it('overwrites the same reportId', async () => {
		await saveDraft('r1', 't1', '[]');
		await saveDraft('r1', 't1', '[{"fieldId":"a","valueText":"x"}]');
		const got = await getDraft('r1');
		expect(got?.valuesJson).toBe('[{"fieldId":"a","valueText":"x"}]');
	});

	it('deleteDraft removes only that key', async () => {
		await saveDraft('r1', 't1', '[]');
		await saveDraft('r2', 't1', '[]');
		await deleteDraft('r1');
		expect(await getDraft('r1')).toBeNull();
		expect(await getDraft('r2')).not.toBeNull();
	});

	it('listDrafts returns all', async () => {
		await saveDraft('r1', 't1', '[]');
		await saveDraft('r2', 't1', '[]');
		const all = await listDrafts();
		expect(all.length).toBe(2);
		const ids = all.map((d) => d.reportId).sort();
		expect(ids).toEqual(['r1', 'r2']);
	});

	it('handles a large valuesJson payload', async () => {
		const big = 'x'.repeat(1024 * 1024);
		const payload = JSON.stringify([{ fieldId: 'big', valueText: big }]);
		await saveDraft('r1', 't1', payload);
		const got = await getDraft('r1');
		expect(got?.valuesJson.length).toBe(payload.length);
	});

	it('getDraft on a missing key returns null', async () => {
		expect(await getDraft('nope')).toBeNull();
	});
});

describe('idb-drafts — submission_queue store', () => {
	it('preserves insertion order via autoIncrement', async () => {
		const id1 = await enqueueQueueItem({
			reportId: 'r1',
			valuesJson: '[]',
			attemptedAt: Date.now()
		});
		const id2 = await enqueueQueueItem({
			reportId: 'r2',
			valuesJson: '[]',
			attemptedAt: Date.now()
		});
		expect(id2).toBeGreaterThan(id1);
		const all = await listQueue();
		expect(all.map((q) => q.reportId)).toEqual(['r1', 'r2']);
	});

	it('deleteQueueItem removes the named row only', async () => {
		const id1 = await enqueueQueueItem({
			reportId: 'r1',
			valuesJson: '[]',
			attemptedAt: Date.now()
		});
		await enqueueQueueItem({ reportId: 'r2', valuesJson: '[]', attemptedAt: Date.now() });
		await deleteQueueItem(id1);
		const all = await listQueue();
		expect(all.length).toBe(1);
		expect(all[0].reportId).toBe('r2');
	});
});
