import { drainQueue, peekQueue } from './submission-queue';

// Phase 8 — drains the IndexedDB submission queue when connectivity returns.
//
// The window `online` event (and the asop:back-online custom event the
// OfflineBanner dispatches) is the primary trigger. iOS Safari doesn't fire
// the SW `sync` event, so we cannot rely on Background Sync — this window-
// level drainer is the canonical drain path. Background Sync is registered
// alongside as an enhancement on browsers that support it.

let mounted = false;

export type DrainerToast = {
	success: (msg: string) => void;
	error: (msg: string) => void;
};

export function mountDrainer(toast: DrainerToast): void {
	if (mounted) return;
	mounted = true;

	let draining = false;
	const drain = async () => {
		if (draining) return;
		draining = true;
		try {
			const items = await peekQueue();
			if (items.length === 0) return;
			const { ok, failed } = await drainQueue();
			if (ok > 0) toast.success(ok === 1 ? 'Report submitted' : `${ok} reports submitted`);
			if (failed > 0) {
				toast.error(
					failed === 1
						? 'A report could not be submitted. Open it to retry.'
						: `${failed} reports could not be submitted.`
				);
			}
		} catch {
			// Swallow — next online event will retry.
		} finally {
			draining = false;
		}
	};

	window.addEventListener('online', drain);
	window.addEventListener('asop:back-online', drain as EventListener);

	// Cover the "user reopened the tab while online and queue had items" case.
	if (navigator.onLine) {
		void drain();
	}
}
