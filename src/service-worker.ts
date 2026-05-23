/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

// Phase 1: pre-cache the app shell only. Runtime caching (network-first for
// scoped API GETs, offline drafts via IndexedDB, queued background sync) lands
// in Phase 8 — the fetch handler here is intentionally a no-op so dev
// surprises stay contained.

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `app-shell-${version}`;
const SHELL = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
		)
	);
});

// Phase 8 will replace this stub with stale-while-revalidate + network-first.
sw.addEventListener('fetch', () => {
	/* no-op */
});
