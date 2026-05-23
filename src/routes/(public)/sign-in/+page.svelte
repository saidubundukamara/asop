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

<svelte:head><title>Sign in · ADSAT Ops</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Sign in</Card.Title>
		<Card.Description>Use your work email and password.</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if data.flashes.notice}
			<Alert.Root class="mb-4">
				<Alert.Description>{data.flashes.notice}</Alert.Description>
			</Alert.Root>
		{/if}
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
			<div class="grid gap-1.5">
				<Label for="email">Email</Label>
				<Input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					value={form?.email ?? ''}
				/>
			</div>
			<div class="grid gap-1.5">
				<div class="flex items-center justify-between">
					<Label for="password">Password</Label>
					<a href="/forgot-password" class="text-muted-foreground text-xs hover:underline"
						>Forgot password?</a
					>
				</div>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</div>
			<Button type="submit" disabled={submitting}>
				{submitting ? 'Signing in…' : 'Sign in'}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
