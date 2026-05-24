// Minimal promise-wrapped IndexedDB helper. ~40 lines instead of an idb dep
// because the surface we use (open + simple get/put/delete on a couple of
// stores) is small enough that the wrapper is cheaper than the dependency.

export function openDB(
	name: string,
	version: number,
	upgrade: (db: IDBDatabase, oldVersion: number) => void
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(name, version);
		req.onupgradeneeded = (event) => {
			const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
			upgrade(req.result, oldVersion);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
		req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
	});
}

export function tx<T>(
	db: IDBDatabase,
	stores: string | string[],
	mode: IDBTransactionMode,
	work: (t: IDBTransaction) => Promise<T> | T
): Promise<T> {
	return new Promise((resolve, reject) => {
		const t = db.transaction(stores, mode);
		let result: T;
		t.oncomplete = () => resolve(result);
		t.onerror = () => reject(t.error);
		t.onabort = () => reject(t.error ?? new Error('transaction aborted'));
		Promise.resolve(work(t))
			.then((r) => {
				result = r;
			})
			.catch((err) => {
				reject(err);
				t.abort();
			});
	});
}

export function reqAsPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
