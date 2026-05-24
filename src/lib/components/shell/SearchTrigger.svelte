<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '$lib/components/ui/button';

	let { onOpen }: { onOpen: () => void } = $props();
</script>

<Button variant="ghost" size="icon" aria-label="Search (Cmd+K)" onclick={onOpen}>
	<SearchIcon class="size-5" />
</Button>
