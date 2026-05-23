<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';

	type Department = { id: string; name: string };

	type Props = {
		open: boolean;
		target: {
			name: string;
			phone: string | null;
			role: string;
			departmentId: string | null;
		};
		departments: Department[];
	};

	let { open, target, departments }: Props = $props();
	let submitting = $state(false);
	let issues = $state<Record<string, string[]> | null>(null);

	function close() {
		const url = new URL(page.url);
		url.searchParams.delete('action');
		// URL stays on the same route — closing the sheet just drops ?action.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { replaceState: true, noScroll: true });
	}
</script>

<Sheet.Root
	{open}
	onOpenChange={(o) => {
		if (!o) close();
	}}
>
	<Sheet.Content side="right" class="w-full max-w-md">
		<Sheet.Header>
			<Sheet.Title>Edit staff member</Sheet.Title>
			<Sheet.Description>Updates are logged in the audit trail.</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action="?/edit"
			use:enhance={() => {
				submitting = true;
				issues = null;
				return async ({ result, update }) => {
					await update({ reset: false });
					submitting = false;
					if (result.type === 'success') {
						toast.success('Staff member updated');
						await invalidateAll();
						close();
					} else if (result.type === 'failure') {
						const fail = result.data as { issues?: Record<string, string[]> } | undefined;
						issues = fail?.issues ?? null;
						toast.error('Could not save changes');
					}
				};
			}}
			class="grid gap-4 px-4 py-2"
		>
			<div class="grid gap-1.5">
				<Label for="edit-name">Full name</Label>
				<Input id="edit-name" name="name" type="text" required value={target.name} />
				{#if issues?.name}<p class="text-xs text-destructive">{issues.name[0]}</p>{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="edit-phone">Phone</Label>
				<Input id="edit-phone" name="phone" type="tel" value={target.phone ?? ''} />
			</div>

			<div class="grid gap-1.5">
				<Label for="edit-role">Role</Label>
				<select
					id="edit-role"
					name="role"
					required
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<option value="staff" selected={target.role === 'staff'}>Staff</option>
					<option value="manager" selected={target.role === 'manager'}>Manager</option>
					<option value="admin" selected={target.role === 'admin'}>Admin</option>
				</select>
			</div>

			<div class="grid gap-1.5">
				<Label for="edit-department">Department</Label>
				<select
					id="edit-department"
					name="departmentId"
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<option value="" selected={target.departmentId === null}>— none —</option>
					{#each departments as d (d.id)}
						<option value={d.id} selected={target.departmentId === d.id}>{d.name}</option>
					{/each}
				</select>
			</div>

			<Sheet.Footer>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Saving…' : 'Save changes'}
				</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
