<script lang="ts">
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
</script>

<div
	class="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-foreground"
	style="padding-top: max(var(--safe-top), 2rem); padding-bottom: max(var(--safe-bottom), 2rem);"
>
	<div class="mb-8 flex items-center gap-2 font-semibold tracking-tight">
		<span
			class="inline-flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
			>A</span
		>
		<span>ADSAT Ops</span>
	</div>
	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</div>
<Toaster />
