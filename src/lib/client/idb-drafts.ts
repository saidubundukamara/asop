import { openDB, tx, reqAsPromise } from './idb';

// IndexedDB-backed draft store for report submissions (Phase 8).
//
// Stores:
//   - drafts             keyPath 'reportId'  → in-progress report values
//   - submission_queue   keyPath 'id' (autoIncrement, index by_reportId)
//                                          → submissions waiting for connectivity
//
// IndexedDB survives service worker upgrades — the SW activate handler must
// NEVER delete IndexedDB data, only stale Cache Storage entries.

export const DB_NAME = 'asop';
export const DB_VERSION = 1;
export const STORE_DRAFTS = 'drafts';
export const STORE_QUEUE = 'submission_queue';

export type DraftRecord = {
	reportId: string;
	templateId: string;
	valuesJson: string;
	updatedAt: number;
};

export type QueueRecord = {
	id?: number;
	reportId: string;
	valuesJson: string;
	attemptedAt: number;
	lastError?: string;
};

let cachedDb: IDBDatabase | null = null;

export async function getDB(): Promise<IDBDatabase> {
	if (cachedDb) return cachedDb;
	cachedDb = await openDB(DB_NAME, DB_VERSION, (db, oldVersion) => {
		if (oldVersion < 1) {
			if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
				db.createObjectStore(STORE_DRAFTS, { keyPath: 'reportId' });
			}
			if (!db.objectStoreNames.contains(STORE_QUEUE)) {
				const queue = db.createObjectStore(STORE_QUEUE, {
					keyPath: 'id',
					autoIncrement: true
				});
				queue.createIndex('by_reportId', 'reportId', { unique: false });
			}
		}
	});
	return cachedDb;
}

// Reset cached handle — only used by tests so each case gets a fresh db.
export function _resetForTests() {
	if (cachedDb) cachedDb.close();
	cachedDb = null;
}

export async function saveDraft(
	reportId: string,
	templateId: string,
	valuesJson: string
): Promise<void> {
	const db = await getDB();
	await tx(db, STORE_DRAFTS, 'readwrite', (t) => {
		const store = t.objectStore(STORE_DRAFTS);
		store.put({ reportId, templateId, valuesJson, updatedAt: Date.now() });
	});
}

export async function getDraft(reportId: string): Promise<DraftRecord | null> {
	const db = await getDB();
	return tx(db, STORE_DRAFTS, 'readonly', async (t) => {
		const got = await reqAsPromise(t.objectStore(STORE_DRAFTS).get(reportId));
		return (got as DraftRecord | undefined) ?? null;
	});
}

export async function deleteDraft(reportId: string): Promise<void> {
	const db = await getDB();
	await tx(db, STORE_DRAFTS, 'readwrite', (t) => {
		t.objectStore(STORE_DRAFTS).delete(reportId);
	});
}

export async function listDrafts(): Promise<DraftRecord[]> {
	const db = await getDB();
	return tx(db, STORE_DRAFTS, 'readonly', async (t) => {
		const all = await reqAsPromise(t.objectStore(STORE_DRAFTS).getAll());
		return (all as DraftRecord[]) ?? [];
	});
}

export async function enqueueQueueItem(item: Omit<QueueRecord, 'id'>): Promise<number> {
	const db = await getDB();
	return tx(db, STORE_QUEUE, 'readwrite', async (t) => {
		const id = await reqAsPromise(t.objectStore(STORE_QUEUE).add(item));
		return id as number;
	});
}

export async function listQueue(): Promise<QueueRecord[]> {
	const db = await getDB();
	return tx(db, STORE_QUEUE, 'readonly', async (t) => {
		const all = await reqAsPromise(t.objectStore(STORE_QUEUE).getAll());
		// getAll returns records ordered by key, which is the autoIncrement id →
		// FIFO is preserved.
		return (all as QueueRecord[]) ?? [];
	});
}

export async function deleteQueueItem(id: number): Promise<void> {
	const db = await getDB();
	await tx(db, STORE_QUEUE, 'readwrite', (t) => {
		t.objectStore(STORE_QUEUE).delete(id);
	});
}

export async function updateQueueItem(item: QueueRecord): Promise<void> {
	if (item.id === undefined) throw new Error('updateQueueItem requires id');
	const db = await getDB();
	await tx(db, STORE_QUEUE, 'readwrite', (t) => {
		t.objectStore(STORE_QUEUE).put(item);
	});
}
