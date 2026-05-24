<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
</script>

<svelte:head><title>Offline · ADSAT Ops</title></svelte:head>

<div
	class="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center"
	style="padding-top: var(--safe-top, 0); padding-bottom: var(--safe-bottom, 0);"
>
	<div class="rounded-full bg-muted p-5 text-muted-foreground">
		<WifiOffIcon class="h-10 w-10" />
	</div>
	<h1 class="mt-6 text-2xl font-semibold tracking-tight">You're offline</h1>
	<p class="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
		We'll keep your report drafts safe on this device and submit them when you're back online. Pages
		you've visited recently will still work.
	</p>
	<div class="mt-8 flex gap-3">
		<Button onclick={() => location.reload()}>Try again</Button>
	</div>
</div>
