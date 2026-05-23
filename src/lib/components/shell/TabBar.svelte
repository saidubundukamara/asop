<script lang="ts">
	import { page } from '$app/state';
	import { primaryNav } from './nav-items';
	import { cn } from '$lib/utils';
</script>

<nav
	aria-label="Primary"
	class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 backdrop-blur-md md:hidden"
	style="padding-bottom: var(--safe-bottom);"
>
	{#each primaryNav as item (item.href)}
		{@const Icon = item.icon}
		{@const active =
			item.href === '/dashboard'
				? page.url.pathname === '/dashboard'
				: page.url.pathname.startsWith(item.href)}
		<a
			href={item.href}
			aria-current={active ? 'page' : undefined}
			class={cn(
				'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
				active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
			)}
		>
			<Icon class="size-5" />
			{item.label}
		</a>
	{/each}
</nav>
