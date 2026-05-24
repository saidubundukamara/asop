<script lang="ts">
	import type { ReportFieldType, Prisma } from '@prisma/client';
	import * as Sheet from '$lib/components/ui/sheet';

	type TemplateField = {
		id: string;
		label: string;
		fieldType: ReportFieldType;
		helpText: string | null;
		isRequired: boolean;
		displayOrder: number;
		configJson: Prisma.JsonValue;
		defaultValue: string | null;
	};

	type Template = {
		id: string;
		name: string;
		description: string | null;
		version: number;
		reviewerRole: string;
		department: { id: string; name: string } | null;
		fields: TemplateField[];
	};

	let {
		open,
		templates,
		onselect
	}: {
		open: boolean;
		templates: Template[];
		onselect: (tpl: Template) => void;
	} = $props();

	let search = $state('');

	const filtered = $derived(
		search.trim().length > 0
			? templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
			: templates
	);
</script>

<Sheet.Root {open} onOpenChange={() => {}}>
	<Sheet.Content
		side="bottom"
		class="max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:mx-auto sm:max-w-lg"
	>
		<Sheet.Header>
			<Sheet.Title>Choose a template</Sheet.Title>
			<Sheet.Description>Pick the report type you want to submit.</Sheet.Description>
		</Sheet.Header>

		<div class="mt-3 px-1">
			<input
				type="text"
				bind:value={search}
				placeholder="Search templates…"
				class="mb-3 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
			/>

			{#if filtered.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">
					{templates.length === 0
						? 'No report templates available yet. Ask your admin to create one.'
						: 'No templates match your search.'}
				</p>
			{:else}
				<ul class="space-y-2 pb-4">
					{#each filtered as tpl (tpl.id)}
						<li>
							<button
								type="button"
								onclick={() => onselect(tpl)}
								class="w-full rounded-lg border bg-background px-4 py-3 text-left hover:bg-muted/40 focus:ring-2 focus:ring-ring focus:outline-none"
							>
								<div class="flex items-center gap-2">
									<span class="font-medium">{tpl.name}</span>
									{#if tpl.department}
										<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
											{tpl.department.name}
										</span>
									{/if}
								</div>
								{#if tpl.description}
									<p class="mt-0.5 text-sm text-muted-foreground">{tpl.description}</p>
								{/if}
								<p class="mt-1 text-xs text-muted-foreground">{tpl.fields.length} fields</p>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>
