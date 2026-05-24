/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

// Phase 8 — runtime caching, offline fallback, queued submission replay.

const sw = self as unknown as ServiceWorkerGlobalScope;

const SHELL_CACHE = `app-shell-${version}`;
const RUNTIME_CACHE = `runtime-${version}`;
const API_CACHE = `api-${version}`;
const CURRENT_CACHES = new Set([SHELL_CACHE, RUNTIME_CACHE, API_CACHE]);

const SHELL = [...build, ...files];
const OFFLINE_URL = '/offline';

// The three scoped JSON GETs the plan calls out for network-first caching.
// Keep the list explicit — broad pattern matching here is what makes a SW
// brittle.
const API_PATHS = new Set([
	'/api/tasks/mine',
	'/api/templates/active',
	'/api/notifications/recent'
]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL_CACHE);
			await cache.addAll(SHELL);
			// Best-effort: pre-cache the offline fallback so navigation failures
			// always have something to serve. If the route hasn't been built yet
			// (first install on dev), the catch keeps install from failing.
			try {
				await cache.add(OFFLINE_URL);
			} catch {
				/* ignore */
			}
		})()
	);
});

sw.addEventListener('activate', (event) => {
	// Clean up old Cache Storage entries from prior SW versions. IndexedDB is
	// intentionally untouched here — drafts and the submission queue must
	// survive SW upgrades.
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => !CURRENT_CACHES.has(k)).map((k) => caches.delete(k)))
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	// Cross-origin requests (Cloudinary direct uploads, third-party assets) must
	// pass through untouched — intercepting Cloudinary would break the
	// browser→bucket direct-upload path the attachments flow depends on.
	if (url.origin !== location.origin) return;

	if (req.mode === 'navigate') {
		event.respondWith(handleNavigation(req));
		return;
	}

	if (API_PATHS.has(url.pathname)) {
		event.respondWith(handleApi(req));
		return;
	}

	// Static asset (build output, files, /_app/...): cache-first.
	if (SHELL.includes(url.pathname) || url.pathname.startsWith('/_app/')) {
		event.respondWith(handleAsset(req));
		return;
	}

	// Everything else (uncached same-origin GETs — e.g. dynamic JSON not in
	// the API_PATHS list): default to network.
});

// Stale-while-revalidate for navigations: serve the cached HTML immediately
// if we have one, then refresh in the background. If neither cache nor
// network has it, fall back to the precached /offline page.
async function handleNavigation(req: Request): Promise<Response> {
	const cache = await caches.open(RUNTIME_CACHE);
	const cached = await cache.match(req);

	const networkPromise = fetch(req)
		.then((res) => {
			if (res && res.status === 200) cache.put(req, res.clone());
			return res;
		})
		.catch(() => null);

	if (cached) {
		// Don't await the revalidation — let it run in the background.
		void networkPromise;
		return cached;
	}

	const fresh = await networkPromise;
	if (fresh) return fresh;

	const offline = await caches.match(OFFLINE_URL);
	if (offline) return offline;

	return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

// Network-first for the three scoped JSON GETs: prefer fresh data but fall
// back to the last good response if the network is unreachable.
async function handleApi(req: Request): Promise<Response> {
	const cache = await caches.open(API_CACHE);
	try {
		const res = await fetch(req);
		if (res && res.status === 200) cache.put(req, res.clone());
		return res;
	} catch {
		const cached = await cache.match(req);
		if (cached) return cached;
		return new Response(JSON.stringify({ error: 'offline' }), {
			status: 503,
			headers: { 'content-type': 'application/json' }
		});
	}
}

// Cache-first for shell assets — they're versioned via `version` and replaced
// wholesale on activate.
async function handleAsset(req: Request): Promise<Response> {
	const cache = await caches.open(SHELL_CACHE);
	const cached = await cache.match(req);
	if (cached) return cached;
	try {
		const res = await fetch(req);
		if (res && res.status === 200) cache.put(req, res.clone());
		return res;
	} catch {
		return new Response('', { status: 504 });
	}
}

// Background Sync (Phase 8) — drain the IndexedDB submission queue when the
// browser fires `sync`. Progressive enhancement: works on Android Chrome and
// desktop Chrome, not on iOS Safari. The window-level `online` drainer in
// src/lib/client/online-drainer.ts is the primary mechanism.
sw.addEventListener('sync', (event: Event) => {
	const e = event as SyncEvent;
	if (e.tag === 'report-submit') {
		e.waitUntil(drainSubmissionQueueInSW());
	}
});

async function drainSubmissionQueueInSW(): Promise<void> {
	const db = await openSwDB();
	const items = await swGetAll(db, 'submission_queue');

	for (const item of items as Array<{
		id: number;
		reportId: string;
		valuesJson: string;
	}>) {
		const body = new FormData();
		body.append('reportId', item.reportId);
		body.append('valuesJson', item.valuesJson);

		// If fetch rejects, we let it propagate — the browser keeps the sync
		// registered and tries again later. That's the desired behavior.
		const res = await fetch('/reports/new?/submit', { method: 'POST', body });

		if (res.ok && res.url.includes('/reports/') && !res.url.includes('/reports/new')) {
			await swDelete(db, 'submission_queue', item.id);
			await swDelete(db, 'drafts', item.reportId);
			continue;
		}

		// On 4xx/5xx leave the item in place but stop the drain so we don't loop
		// failure-fast. The next sync (or `online` event) will retry.
		throw new Error(`submit failed: ${res.status}`);
	}
}

function openSwDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open('asop', 1);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function swGetAll(db: IDBDatabase, store: string): Promise<unknown[]> {
	return new Promise((resolve, reject) => {
		const t = db.transaction(store, 'readonly');
		const req = t.objectStore(store).getAll();
		req.onsuccess = () => resolve(req.result as unknown[]);
		req.onerror = () => reject(req.error);
	});
}

function swDelete(db: IDBDatabase, store: string, key: IDBValidKey): Promise<void> {
	return new Promise((resolve, reject) => {
		const t = db.transaction(store, 'readwrite');
		t.objectStore(store).delete(key);
		t.oncomplete = () => resolve();
		t.onerror = () => reject(t.error);
	});
}

// Phase 5 — Web Push delivery (preserved from prior version).
sw.addEventListener('push', (event: PushEvent) => {
	const data = event.data?.json() as
		| { title?: string; body?: string; deepLink?: string }
		| undefined;
	if (!data?.title) return;
	event.waitUntil(
		sw.registration.showNotification(data.title, {
			body: data.body,
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			data: { deepLink: data.deepLink ?? '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event: NotificationEvent) => {
	event.notification.close();
	const deepLink: string = (event.notification.data as { deepLink?: string })?.deepLink ?? '/';
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			const existing = clients.find((c) => 'focus' in c);
			if (existing) {
				return (existing as WindowClient).focus().then((c) => c.navigate(deepLink));
			}
			return sw.clients.openWindow(deepLink);
		})
	);
});

// SyncEvent isn't in the default TS DOM lib; declare the minimal shape we use.
interface SyncEvent extends Event {
	readonly tag: string;
	waitUntil(promise: Promise<unknown>): void;
}
