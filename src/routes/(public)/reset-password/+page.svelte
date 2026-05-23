<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import * as Alert from '$lib/components/ui/alert';
	import type { ActionData, PageData } from './$types';

	let { form, data }: { form: ActionData; data: PageData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Reset password · ADSAT Ops</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Set a new password</Card.Title>
		<Card.Description
			>Minimum 10 characters, at least one number, not a commonly-used password.</Card.Description
		>
	</Card.Header>
	<Card.Content>
		{#if form?.message}
			<Alert.Root variant="destructive" class="mb-4">
				<Alert.Description>{form.message}</Alert.Description>
			</Alert.Root>
		{/if}
		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
			class="grid gap-4"
		>
			<input type="hidden" name="token" value={data.token} />
			<div class="grid gap-1.5">
				<Label for="password">New password</Label>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					required
					minlength={10}
				/>
			</div>
			<Button type="submit" disabled={submitting}>
				{submitting ? 'Updating…' : 'Reset password'}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
