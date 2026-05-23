<script lang="ts">
	import { Toaster } from '$lib/components/ui/sonner';

	// Placeholder shell — TopBar / TabBar / Sidebar arrive in chunk 7.
	let { children } = $props();
</script>

<div class="bg-background text-foreground min-h-dvh">
	{@render children()}
</div>
<Toaster />
