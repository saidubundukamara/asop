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

// Resend wiring is stubbed until sender domain DNS lands (PRD open Q#3).
// When ready: import { Resend } from 'resend', call client.emails.send({...}).
const resendTransport: EmailTransport = async () => {
	throw new Error('Resend transport is not wired yet. Set EMAIL_TRANSPORT=dev or wire chunk 8.');
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
