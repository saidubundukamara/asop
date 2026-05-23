<script lang="ts">
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
</script>

<div
	class="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center px-4"
	style="padding-top: max(var(--safe-top), 2rem); padding-bottom: max(var(--safe-bottom), 2rem);"
>
	<div class="mb-8 flex items-center gap-2 font-semibold tracking-tight">
		<span
			class="bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-md text-xs font-bold"
			>A</span
		>
		<span>ADSAT Ops</span>
	</div>
	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</div>
<Toaster />
