<script lang="ts">
	import { building } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import XIcon from '@lucide/svelte/icons/x';

	// Phase 8 — contextual install prompt. Only shown to mobile users in
	// browser mode (not standalone), and only on the second-or-later visit so
	// new users aren't nagged immediately. iOS Safari doesn't fire
	// `beforeinstallprompt`, so we surface a Share-icon hint there instead.

	const VISIT_KEY = 'asop:visit-count';
	const DISMISS_KEY = 'asop:install-dismissed-at';
	const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

	type DeferredPrompt = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	};

	let shown = $state(false);
	let isIos = $state(false);
	let deferred = $state<DeferredPrompt | null>(null);

	$effect(() => {
		if (building) return;
		if (typeof window === 'undefined') return;

		// Bump visit count once per app load.
		const prev = Number(localStorage.getItem(VISIT_KEY) ?? '0') || 0;
		const next = prev + 1;
		localStorage.setItem(VISIT_KEY, String(next));

		const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? '0') || 0;
		if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return;

		const isMobile = window.matchMedia('(max-width: 767px)').matches;
		const standalone = window.matchMedia('(display-mode: standalone)').matches;
		if (!isMobile || standalone) return;
		if (next < 2) return;

		isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

		if (isIos) {
			shown = true;
			return;
		}

		const onBeforeInstall = (e: Event) => {
			e.preventDefault();
			deferred = e as DeferredPrompt;
			shown = true;
		};
		window.addEventListener('beforeinstallprompt', onBeforeInstall);
		return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
	});

	async function install() {
		if (!deferred) return;
		shown = false;
		try {
			await deferred.prompt();
			await deferred.userChoice;
		} catch {
			// User dismissed or browser threw — no-op.
		}
		deferred = null;
		localStorage.setItem(DISMISS_KEY, String(Date.now()));
	}

	function dismiss() {
		shown = false;
		localStorage.setItem(DISMISS_KEY, String(Date.now()));
	}
</script>

{#if shown}
	<div
		class="fixed bottom-20 left-1/2 z-50 w-80 -translate-x-1/2 rounded-xl border bg-background p-4 shadow-lg md:bottom-6"
	>
		<button
			type="button"
			class="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
			aria-label="Dismiss"
			onclick={dismiss}
		>
			<XIcon class="h-4 w-4" />
		</button>
		<div class="flex items-start gap-3">
			<div class="rounded-lg bg-muted p-2 text-muted-foreground">
				<DownloadIcon class="h-4 w-4" />
			</div>
			<div class="flex-1 pr-4">
				<p class="text-sm font-medium">Install ADSAT Ops</p>
				{#if isIos}
					<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
						Tap the Share icon in Safari, then choose <span class="font-medium"
							>Add to Home Screen</span
						>.
					</p>
				{:else}
					<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
						Get faster access and offline drafts. No account needed beyond what you have.
					</p>
					<div class="mt-3">
						<Button size="sm" onclick={install}>Install</Button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
