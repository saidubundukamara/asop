import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';

// Cloudinary signed-upload helper (PRD § 15.4). The browser PUTs bytes
// straight to *.cloudinary.com using params we sign here — our server never
// proxies the file content. Phase 2 only uses this for the profile photo;
// Phase 6 adds /api/attachments + the full <FileDropzone> on top of the same
// signing endpoint.
//
// Read env via $env/dynamic/private so changes pick up on Vercel without a
// redeploy and so the value is never bundled into client code.

const cloudName = env.CLOUDINARY_CLOUD_NAME;
const apiKey = env.CLOUDINARY_API_KEY;
const apiSecret = env.CLOUDINARY_API_SECRET;

let configured = false;
function ensureConfigured(): void {
	if (configured) return;
	if (!cloudName || !apiKey || !apiSecret) {
		throw new Error(
			'Cloudinary env vars missing: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'
		);
	}
	cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
	configured = true;
}

export type SignUploadInput = {
	folder: string;
	publicId?: string;
};

export type SignedUploadParams = {
	signature: string;
	timestamp: number;
	apiKey: string;
	cloudName: string;
	folder: string;
	publicId?: string;
};

export function signUploadParams(input: SignUploadInput): SignedUploadParams {
	ensureConfigured();

	const timestamp = Math.floor(Date.now() / 1000);
	const paramsToSign: Record<string, string | number> = { folder: input.folder, timestamp };
	if (input.publicId) paramsToSign.public_id = input.publicId;

	// Non-null assertion safe — ensureConfigured() throws if any are missing.
	const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret!);

	return {
		signature,
		timestamp,
		apiKey: apiKey!,
		cloudName: cloudName!,
		folder: input.folder,
		publicId: input.publicId
	};
}
