<script lang="ts">
	import { page } from '$app/state';
	import { primaryNav, secondaryNavForRole, type NavItem } from './nav-items';
	import { cn } from '$lib/utils';

	const secondary = $derived(secondaryNavForRole(page.data.user?.role));

	function isActive(href: string, item: NavItem): boolean {
		return item.href === '/dashboard'
			? page.url.pathname === '/dashboard'
			: page.url.pathname.startsWith(item.href);
	}
</script>

<aside
	aria-label="Primary"
	class="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 border-r bg-sidebar p-3 text-sidebar-foreground md:flex md:flex-col"
	style="padding-left: max(var(--safe-left), 0.75rem); padding-top: calc(0.75rem + var(--safe-top));"
>
	<nav class="flex flex-col gap-0.5">
		{#each primaryNav as item (item.href)}
			{@const Icon = item.icon}
			{@const active = isActive(item.href, item)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				class={cn(
					'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
					active
						? 'bg-sidebar-accent text-sidebar-accent-foreground'
						: 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
				)}
			>
				<Icon class="size-4" />
				{item.label}
			</a>
		{/each}
	</nav>

	{#if secondary.length > 0}
		<div class="mt-4 border-t pt-3">
			<p class="px-3 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
				Manage
			</p>
			<nav class="flex flex-col gap-0.5">
				{#each secondary as item (item.href)}
					{@const Icon = item.icon}
					{@const active = isActive(item.href, item)}
					<a
						href={item.href}
						aria-current={active ? 'page' : undefined}
						class={cn(
							'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
							active
								? 'bg-sidebar-accent text-sidebar-accent-foreground'
								: 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
						)}
					>
						<Icon class="size-4" />
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	{/if}
</aside>
