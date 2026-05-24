<script lang="ts">
	import { onMount } from 'svelte';
	import { building } from '$app/environment';
	import { Toaster } from '$lib/components/ui/sonner';
	import TopBar from '$lib/components/shell/TopBar.svelte';
	import TabBar from '$lib/components/shell/TabBar.svelte';
	import Sidebar from '$lib/components/shell/Sidebar.svelte';
	import PushOptIn from '$lib/components/notifications/PushOptIn.svelte';

	let { children } = $props();

	onMount(() => {
		if (building || !('serviceWorker' in navigator)) return;
		navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch(() => {});
	});
</script>

<div class="min-h-dvh bg-background text-foreground">
	<TopBar />

	<div class="md:flex">
		<Sidebar />

		<!-- Scroll container. overscroll-behavior:contain prevents body bounce on
		     iOS while letting nested lists pull-to-refresh later (Phase 8). -->
		<main class="flex-1 overflow-y-auto pb-20 md:pb-0" style="overscroll-behavior: contain;">
			{@render children()}
		</main>
	</div>

	<TabBar />
</div>
<Toaster />
<PushOptIn />
