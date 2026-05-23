import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireUser } from '$lib/server/auth/guards';
import { signUploadParams } from '$lib/server/cloudinary';
import type { RequestHandler } from './$types';

// POST /api/uploads/sign — returns signed Cloudinary upload params for an
// authenticated user. The browser uses these to PUT bytes directly to
// *.cloudinary.com (no proxy through our origin). Folder is whitelisted to
// prevent path injection; Phase 2 only allows 'profile-photos', Phase 6 will
// add 'task-attachments', 'report-attachments', etc.

const ALLOWED_FOLDERS = new Set(['profile-photos']);

const bodySchema = z.object({
	folder: z.string(),
	publicId: z.string().optional()
});

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request body');

	if (!ALLOWED_FOLDERS.has(parsed.data.folder)) {
		throw error(400, `Folder "${parsed.data.folder}" not allowed`);
	}

	// Scope publicId to the actor's user id so one user can't overwrite another's
	// asset. Cloudinary upserts on (folder, public_id), so this also makes
	// re-uploads idempotent — the old photo URL is replaced, not orphaned.
	const publicId = parsed.data.publicId ?? `user-${user.id}`;

	try {
		const signed = signUploadParams({ folder: parsed.data.folder, publicId });
		return json(signed);
	} catch (err) {
		console.error('[uploads/sign] cloudinary configuration error:', err);
		throw error(503, 'Uploads not configured');
	}
};
