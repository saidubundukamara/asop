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
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
	);
});

// Phase 8 will replace this stub with stale-while-revalidate + network-first.
sw.addEventListener('fetch', () => {
	/* no-op */
});

// Phase 5 — Web Push delivery.
sw.addEventListener('push', (event: PushEvent) => {
	const data = event.data?.json() as
		| { title?: string; body?: string; deepLink?: string }
		| undefined;
	if (!data?.title) return;
	event.waitUntil(
		sw.registration.showNotification(data.title, {
			body: data.body,
			icon: '/favicon.png',
			badge: '/favicon.png',
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
