<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';

	type Department = { id: string; name: string };

	type Props = {
		open: boolean;
		departments: Department[];
	};

	let { open, departments }: Props = $props();
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
			<Sheet.Title>Invite staff</Sheet.Title>
			<Sheet.Description>
				They'll get an email with a one-time link to set their password.
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action="?/invite"
			use:enhance={() => {
				submitting = true;
				issues = null;
				return async ({ result, update }) => {
					await update({ reset: true });
					submitting = false;
					if (result.type === 'success') {
						const data = result.data as { data?: { email?: string } } | undefined;
						toast.success(`Invite sent to ${data?.data?.email ?? 'the user'}`);
						close();
					} else if (result.type === 'failure') {
						const fail = result.data as { issues?: Record<string, string[]> } | undefined;
						issues = fail?.issues ?? null;
						toast.error(fail?.issues?.email?.[0] ?? 'Could not send invite');
					}
				};
			}}
			class="grid gap-4 px-4 py-2"
		>
			<div class="grid gap-1.5">
				<Label for="invite-name">Full name</Label>
				<Input id="invite-name" name="name" type="text" required autocomplete="off" />
				{#if issues?.name}
					<p class="text-xs text-destructive">{issues.name[0]}</p>
				{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="invite-email">Email</Label>
				<Input id="invite-email" name="email" type="email" required autocomplete="off" />
				{#if issues?.email}
					<p class="text-xs text-destructive">{issues.email[0]}</p>
				{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="invite-role">Role</Label>
				<select
					id="invite-role"
					name="role"
					required
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<option value="staff" selected>Staff</option>
					<option value="manager">Manager</option>
					<option value="admin">Admin</option>
				</select>
				{#if issues?.role}
					<p class="text-xs text-destructive">{issues.role[0]}</p>
				{/if}
			</div>

			<div class="grid gap-1.5">
				<Label for="invite-department">Department</Label>
				<select
					id="invite-department"
					name="departmentId"
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<option value="">— none —</option>
					{#each departments as dept (dept.id)}
						<option value={dept.id}>{dept.name}</option>
					{/each}
				</select>
			</div>

			<Sheet.Footer>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Sending…' : 'Send invite'}
				</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
