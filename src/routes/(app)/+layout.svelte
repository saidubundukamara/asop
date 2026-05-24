<script lang="ts">
	import { onMount } from 'svelte';
	import { building } from '$app/environment';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner';
	import TopBar from '$lib/components/shell/TopBar.svelte';
	import TabBar from '$lib/components/shell/TabBar.svelte';
	import Sidebar from '$lib/components/shell/Sidebar.svelte';
	import OfflineBanner from '$lib/components/shell/OfflineBanner.svelte';
	import InstallBanner from '$lib/components/shell/InstallBanner.svelte';
	import PushOptIn from '$lib/components/notifications/PushOptIn.svelte';
	import { mountDrainer } from '$lib/client/online-drainer';

	let { children } = $props();

	onMount(() => {
		if (building || !('serviceWorker' in navigator)) return;
		navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch(() => {});
		mountDrainer({
			success: (msg) => toast.success(msg),
			error: (msg) => toast.error(msg)
		});
	});
</script>

<div class="min-h-dvh bg-background text-foreground">
	<TopBar />
	<OfflineBanner />

	<div class="md:flex">
		<Sidebar />

		<!-- Scroll container. overscroll-behavior:contain prevents body bounce on
		     iOS while letting nested lists pull-to-refresh later. -->
		<main class="flex-1 overflow-y-auto pb-20 md:pb-0" style="overscroll-behavior: contain;">
			{@render children()}
		</main>
	</div>

	<TabBar />
</div>
<Toaster />
<PushOptIn />
<InstallBanner />
