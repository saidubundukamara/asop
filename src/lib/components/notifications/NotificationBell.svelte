<script lang="ts">
	import { onMount } from 'svelte';
	import BellIcon from '@lucide/svelte/icons/bell';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import NotificationDropdown from './NotificationDropdown.svelte';

	let unread = $state(0);
	let dropdown: ReturnType<typeof NotificationDropdown> | null = $state(null);

	async function fetchCount() {
		try {
			const res = await fetch('/api/notifications/count');
			if (res.ok) {
				const data = (await res.json()) as { unread: number };
				unread = data.unread;
			}
		} catch {
			// silent — badge just won't update
		}
	}

	onMount(() => {
		fetchCount();
		const id = setInterval(fetchCount, 60_000);
		return () => clearInterval(id);
	});

	function handleOpen(isOpen: boolean) {
		if (isOpen && dropdown) {
			dropdown.load();
		}
		// When closing, refresh the count to reflect any reads.
		if (!isOpen) fetchCount();
	}
</script>

<DropdownMenu.Root onOpenChange={handleOpen}>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" aria-label="Notifications" class="relative">
				<BellIcon class="size-5" />
				{#if unread > 0}
					<span
						class="text-destructive-foreground absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] leading-none font-bold"
					>
						{unread > 99 ? '99+' : unread}
					</span>
				{/if}
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="p-0">
		<NotificationDropdown bind:this={dropdown} />
	</DropdownMenu.Content>
</DropdownMenu.Root>
