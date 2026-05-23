<script lang="ts">
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="rounded-lg border border-dashed p-6 text-center">
	<PaperclipIcon class="mx-auto size-6 text-muted-foreground" />
	<p class="mt-2 text-sm text-muted-foreground">File uploads arrive in Phase 6.</p>
	<Button class="mt-3" variant="outline" size="sm" disabled>Attach file</Button>
</div>
