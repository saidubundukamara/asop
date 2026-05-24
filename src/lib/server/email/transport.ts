export type EmailPayload = {
	to: string;
	subject: string;
	html: string;
	text: string;
};

export type EmailTransport = (payload: EmailPayload) => Promise<void>;

// Dev transport: prints to terminal so we can copy reset / invite URLs from
// the dev log without setting up Resend.
const devTransport: EmailTransport = async (payload) => {
	console.log('\n[email:dev]', JSON.stringify(payload, null, 2), '\n');
};

import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'ADSAT Ops <noreply@example.com>';

const resendTransport: EmailTransport = async (payload) => {
	const client = new Resend(process.env.RESEND_API_KEY);
	await client.emails.send({
		from: FROM,
		to: payload.to,
		subject: payload.subject,
		html: payload.html,
		text: payload.text
	});
};

export function pickTransport(): EmailTransport {
	const choice = process.env.EMAIL_TRANSPORT ?? 'dev';
	switch (choice) {
		case 'dev':
			return devTransport;
		case 'resend':
			return resendTransport;
		default:
			throw new Error(`Unknown EMAIL_TRANSPORT: ${choice}`);
	}
}
