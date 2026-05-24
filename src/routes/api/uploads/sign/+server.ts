import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireUser } from '$lib/server/auth/guards';
import { signUploadParams } from '$lib/server/cloudinary';
import type { RequestHandler } from './$types';

// POST /api/uploads/sign — returns signed Cloudinary upload params for an
// authenticated user. The browser uses these to PUT bytes directly to
// *.cloudinary.com (no proxy through our origin). Folder is whitelisted to
// prevent path injection.

const ALLOWED_FOLDERS = new Set([
	'profile-photos',
	'task-attachments',
	'report-attachments',
	'comment-attachments'
]);

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

	// Profile photos are scoped to user id so re-uploads replace (not orphan) the old asset.
	// Attachment uploads use Cloudinary's auto-generated public_id instead.
	const publicId =
		parsed.data.folder === 'profile-photos'
			? (parsed.data.publicId ?? `user-${user.id}`)
			: parsed.data.publicId;

	try {
		const signed = signUploadParams({ folder: parsed.data.folder, publicId });
		return json(signed);
	} catch (err) {
		console.error('[uploads/sign] cloudinary configuration error:', err);
		throw error(503, 'Uploads not configured');
	}
};
