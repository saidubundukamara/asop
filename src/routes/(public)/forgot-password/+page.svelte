<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import * as Alert from '$lib/components/ui/alert';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Forgot password · ADSAT Ops</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Forgot password</Card.Title>
		<Card.Description>We'll email you a link to reset it.</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if form && 'sent' in form && form.sent}
			<Alert.Root class="mb-4">
				<Alert.Description>
					If <span class="font-medium">{form.email}</span> matches an account, we sent a link to
					reset the password. Check your inbox.
				</Alert.Description>
			</Alert.Root>
			<a href="/sign-in" class="text-muted-foreground text-sm hover:underline">Back to sign in</a>
		{:else}
			{#if form && 'message' in form && form.message}
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
				<div class="grid gap-1.5">
					<Label for="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						value={(form && 'email' in form && form.email) || ''}
					/>
				</div>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Sending…' : 'Send reset link'}
				</Button>
				<a href="/sign-in" class="text-muted-foreground text-center text-sm hover:underline"
					>Back to sign in</a
				>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
