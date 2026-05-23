<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import ProfilePhotoUpload from '$lib/components/forms/ProfilePhotoUpload.svelte';
	import { TIMEZONES } from '$lib/timezones';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const profile = $derived(data.profile);
	const departmentLabel = $derived(profile.department?.name ?? '—');

	let savingProfile = $state(false);
</script>

<svelte:head><title>Profile · ADSAT Ops</title></svelte:head>

<div class="mx-auto grid max-w-2xl gap-6 px-4 py-6 md:py-10">
	<header>
		<h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">Profile</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Your personal details. Email, role, and department can only be changed by an admin.
		</p>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>Photo</Card.Title>
			<Card.Description>JPG or PNG, square works best.</Card.Description>
		</Card.Header>
		<Card.Content>
			<ProfilePhotoUpload
				currentUrl={profile.photoUrl ?? null}
				fallbackInitials={(profile.name || profile.email)
					.split(/\s+/)
					.slice(0, 2)
					.map((p) => p[0]?.toUpperCase() ?? '')
					.join('')}
				onUploaded={async () => {
					await invalidateAll();
				}}
			/>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Account</Card.Title>
		</Card.Header>
		<Card.Content class="grid gap-3 text-sm">
			<div class="flex items-baseline justify-between gap-4">
				<span class="text-muted-foreground">Email</span>
				<span class="font-medium">{profile.email}</span>
			</div>
			<div class="flex items-baseline justify-between gap-4">
				<span class="text-muted-foreground">Role</span>
				<span class="font-medium capitalize">{profile.role}</span>
			</div>
			<div class="flex items-baseline justify-between gap-4">
				<span class="text-muted-foreground">Department</span>
				<span class="font-medium">{departmentLabel}</span>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Personal details</Card.Title>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				action="?/update"
				use:enhance={() => {
					savingProfile = true;
					return async ({ result, update }) => {
						await update();
						savingProfile = false;
						if (result.type === 'success') toast.success('Profile updated');
						else if (result.type === 'failure') toast.error('Could not save profile');
					};
				}}
				class="grid gap-4"
			>
				<div class="grid gap-1.5">
					<Label for="name">Full name</Label>
					<Input
						id="name"
						name="name"
						type="text"
						required
						value={form?.ok === false
							? ((form as unknown as { issues?: Record<string, string[]> })?.issues?.name &&
									profile.name) ||
								profile.name
							: profile.name}
						autocomplete="name"
					/>
					{#if form?.ok === false && (form as unknown as { issues?: Record<string, string[]> }).issues?.name}
						<p class="text-xs text-destructive">
							{(form as unknown as { issues: Record<string, string[]> }).issues.name[0]}
						</p>
					{/if}
				</div>

				<div class="grid gap-1.5">
					<Label for="phone">Phone</Label>
					<Input
						id="phone"
						name="phone"
						type="tel"
						autocomplete="tel"
						value={profile.phone ?? ''}
						placeholder="+254 700 000 000"
					/>
				</div>

				<div class="grid gap-1.5">
					<Label for="timeZone">Time zone</Label>
					<select
						id="timeZone"
						name="timeZone"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						required
					>
						{#each TIMEZONES as tz (tz)}
							<option value={tz} selected={profile.timeZone === tz}>{tz}</option>
						{/each}
					</select>
				</div>

				<div>
					<Button type="submit" disabled={savingProfile}>
						{savingProfile ? 'Saving…' : 'Save changes'}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
