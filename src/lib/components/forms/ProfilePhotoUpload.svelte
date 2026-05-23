<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import CameraIcon from '@lucide/svelte/icons/camera';

	// PRD § 15.4 + FR-FILE-1: two-step direct-to-Cloudinary upload. The
	// browser asks our server to sign params, PUTs the bytes straight to
	// *.cloudinary.com, then posts (publicId, secureUrl) back to the
	// `?/setPhoto` form action which updates User.photoUrl. Our origin never
	// proxies the file content.

	type Props = {
		currentUrl: string | null;
		fallbackInitials: string;
		onUploaded?: () => void | Promise<void>;
	};

	let { currentUrl, fallbackInitials, onUploaded }: Props = $props();

	let inputEl: HTMLInputElement;
	let uploading = $state(false);

	async function handleFile(file: File) {
		uploading = true;
		try {
			const signRes = await fetch('/api/uploads/sign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folder: 'profile-photos' })
			});
			if (!signRes.ok) throw new Error(`Sign failed: ${signRes.status}`);
			const signed = (await signRes.json()) as {
				signature: string;
				timestamp: number;
				apiKey: string;
				cloudName: string;
				folder: string;
				publicId?: string;
			};

			const cloudForm = new FormData();
			cloudForm.append('file', file);
			cloudForm.append('api_key', signed.apiKey);
			cloudForm.append('timestamp', String(signed.timestamp));
			cloudForm.append('signature', signed.signature);
			cloudForm.append('folder', signed.folder);
			if (signed.publicId) cloudForm.append('public_id', signed.publicId);

			const uploadRes = await fetch(
				`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
				{ method: 'POST', body: cloudForm }
			);
			if (!uploadRes.ok) throw new Error(`Cloudinary upload failed: ${uploadRes.status}`);
			const cld = (await uploadRes.json()) as { public_id: string; secure_url: string };

			const persist = new FormData();
			persist.append('publicId', cld.public_id);
			persist.append('secureUrl', cld.secure_url);
			const persistRes = await fetch('/profile?/setPhoto', { method: 'POST', body: persist });
			if (!persistRes.ok) throw new Error(`Save failed: ${persistRes.status}`);

			toast.success('Photo updated');
			await onUploaded?.();
		} catch (err) {
			console.error('[profile-photo-upload]', err);
			toast.error('Could not update photo');
		} finally {
			uploading = false;
			if (inputEl) inputEl.value = '';
		}
	}

	function onChange(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		if (file) void handleFile(file);
	}
</script>

<div class="flex items-center gap-4">
	<Avatar class="size-20">
		{#if currentUrl}
			<AvatarImage src={currentUrl} alt="Profile photo" />
		{/if}
		<AvatarFallback class="text-xl">{fallbackInitials || '?'}</AvatarFallback>
	</Avatar>

	<div class="flex flex-col gap-2">
		<!-- capture="environment" hints iOS/Android to surface the camera. The
		     accept filter still allows picking from the gallery, so users get
		     both options from the native picker. -->
		<input
			bind:this={inputEl}
			id="profile-photo-input"
			type="file"
			accept="image/*"
			capture="environment"
			class="sr-only"
			onchange={onChange}
		/>
		<Button type="button" variant="outline" disabled={uploading} onclick={() => inputEl?.click()}>
			<CameraIcon class="size-4" />
			{uploading ? 'Uploading…' : currentUrl ? 'Change photo' : 'Upload photo'}
		</Button>
	</div>
</div>
