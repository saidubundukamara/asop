import { pickTransport, type EmailPayload } from './transport';

const FROM = process.env.EMAIL_FROM ?? 'ADSAT Ops <noreply@example.com>';

export async function sendEmail(payload: EmailPayload): Promise<void> {
	const transport = pickTransport();
	try {
		await transport(payload);
	} catch (err) {
		// Email failures must never throw out of a form action — the user-facing
		// flow (sign-up, reset, invite) has already succeeded by the time we
		// reach here. Log and move on so the caller doesn't see a 500.
		console.error('[email:error]', { to: payload.to, subject: payload.subject, err });
	}
}

export function getSender(): string {
	return FROM;
}
