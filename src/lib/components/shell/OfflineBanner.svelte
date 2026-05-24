<script lang="ts">
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';

	let online = $state(true);

	$effect(() => {
		if (typeof navigator === 'undefined') return;
		online = navigator.onLine;

		const handleOnline = () => {
			online = true;
			// Decouple the queue drainer from this component — it listens for
			// either 'online' on the window or this custom event. Dispatching here
			// gives downstream code one consistent signal even on browsers where
			// `online`/`offline` events are flaky in installed PWA contexts.
			window.dispatchEvent(new CustomEvent('asop:back-online'));
		};
		const handleOffline = () => {
			online = false;
		};
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});
</script>

{#if !online}
	<div
		class="sticky z-20 flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/60 dark:text-amber-200"
		style="top: calc(3.5rem + var(--safe-top, 0px));"
		role="status"
		aria-live="polite"
	>
		<WifiOffIcon class="h-3.5 w-3.5" />
		<span>You're offline — showing your last data. We'll submit when you're back.</span>
	</div>
{/if}
