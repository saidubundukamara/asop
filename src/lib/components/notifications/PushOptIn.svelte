<script lang="ts">
	import { building } from '$app/environment';

	let shown = $state(false);
	let dismissed = $state(false);

	// Convert VAPID public key from base64url to Uint8Array for pushManager.subscribe().
	function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(base64);
		const arr = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
		return arr.buffer as ArrayBuffer;
	}

	$effect(() => {
		if (building || dismissed) return;
		if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
		if (Notification.permission !== 'default') return;
		// Delay slightly so the opt-in doesn't fire immediately on page load.
		const t = setTimeout(() => (shown = true), 3000);
		return () => clearTimeout(t);
	});

	async function requestPush() {
		shown = false;
		dismissed = true;
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') return;
			const reg = await navigator.serviceWorker.ready;
			const { vapidPublicKey } = await fetch('/api/push/subscribe').then(
				(r) => r.json() as Promise<{ vapidPublicKey: string }>
			);
			if (!vapidPublicKey) return;
			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
			});
			await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(sub.toJSON())
			});
		} catch {
			// Non-fatal — user can opt in from profile settings.
		}
	}

	function dismiss() {
		shown = false;
		dismissed = true;
	}
</script>

{#if shown}
	<div
		class="fixed bottom-20 left-1/2 z-50 w-80 -translate-x-1/2 rounded-xl border bg-background p-4 shadow-lg md:bottom-6"
	>
		<p class="text-sm font-semibold">Stay in the loop</p>
		<p class="mt-1 text-xs text-muted-foreground">
			Get push notifications when tasks are assigned to you or reports need attention.
		</p>
		<div class="mt-3 flex gap-2">
			<button
				type="button"
				onclick={requestPush}
				class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
			>
				Enable notifications
			</button>
			<button
				type="button"
				onclick={dismiss}
				class="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
			>
				Not now
			</button>
		</div>
	</div>
{/if}
