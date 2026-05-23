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

<svelte:head><title>Accept invitation · ADSAT Ops</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Welcome to ADSAT Ops</Card.Title>
		<Card.Description>Set a password to finish creating your account.</Card.Description>
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
				<Label for="password">Choose a password</Label>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					required
					minlength={10}
				/>
				<p class="text-xs text-muted-foreground">
					Minimum 10 characters, at least one number, not a commonly-used password.
				</p>
			</div>
			<Button type="submit" disabled={submitting}>
				{submitting ? 'Creating account…' : 'Create my account'}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
