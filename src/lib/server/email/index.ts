import { sendEmail } from './send';
import { inviteEmail, passwordResetEmail } from './templates';

export async function sendInviteEmail(to: string, url: string, inviterName?: string) {
	const t = inviteEmail({ url, inviterName });
	await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}

export async function sendPasswordResetEmail(to: string, url: string) {
	const t = passwordResetEmail({ url });
	await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}
