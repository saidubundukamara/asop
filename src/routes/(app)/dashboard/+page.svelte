<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="mx-auto max-w-3xl px-4 py-8">
	<h1 class="text-2xl font-semibold">Dashboard</h1>
	<p class="mt-2 text-sm text-muted-foreground">
		Signed in as <span class="font-medium text-foreground">{data.user.email}</span> · role
		<span class="font-medium text-foreground">{data.user.role}</span>
	</p>
	<p class="mt-4 text-sm text-muted-foreground">
		Phase 1 placeholder. Real dashboard cards arrive in Phase 7.
	</p>
</div>
