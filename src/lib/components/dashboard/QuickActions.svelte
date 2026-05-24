<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import UsersIcon from '@lucide/svelte/icons/users';
	import FileCogIcon from '@lucide/svelte/icons/file-cog';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import type { QuickActionData } from '$lib/server/dashboard/summary';

	let { actions }: { actions: QuickActionData[] } = $props();

	const iconMap = {
		plus: PlusIcon,
		'file-text': FileTextIcon,
		'check-circle': CheckCircleIcon,
		users: UsersIcon,
		'file-cog': FileCogIcon,
		shield: ShieldIcon
	} as const;
</script>

<div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:overflow-visible">
	{#each actions as action (action.href)}
		{@const Icon = iconMap[action.icon]}
		<a
			href={action.href}
			class="inline-flex h-11 min-w-fit shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		>
			<Icon class="size-4" />
			{action.label}
		</a>
	{/each}
</div>
