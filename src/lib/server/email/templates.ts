// Minimal template-literal email rendering. When real Resend wiring lands
// (PRD open Q#3), swap this for svelte-email or mjml so we get inlined CSS
// that survives Outlook/Gmail. For Phase 1's dev transport (console.log),
// plain HTML is enough.

const APP_URL = process.env.PUBLIC_APP_URL ?? 'http://localhost:5173';

function wrap(title: string, bodyHtml: string): string {
	return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 560px; margin: 24px auto; padding: 24px;">
${bodyHtml}
<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="color:#888;font-size:12px">ADSAT Staff Operations Platform · ${APP_URL}</p>
</body></html>`;
}

export function inviteEmail(opts: { url: string; inviterName?: string }) {
	const inviter = opts.inviterName ? `${opts.inviterName} has` : 'You have been';
	return {
		subject: 'You have been invited to ADSAT Ops',
		html: wrap(
			'Invitation to ADSAT Ops',
			`<h1 style="margin:0 0 8px;font-size:20px">You have been invited</h1>
<p>${inviter} invited you to join the ADSAT Staff Operations Platform.</p>
<p>Click the button below to set your password and sign in. The link expires in 7 days.</p>
<p style="margin:24px 0"><a href="${opts.url}" style="background:#0a0a0a;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a></p>
<p style="color:#666;font-size:13px">Or copy this link: <br><a href="${opts.url}">${opts.url}</a></p>`
		),
		text: `You have been invited to ADSAT Ops.\n\nSet your password: ${opts.url}\n\nThe link expires in 7 days.`
	};
}

export function passwordResetEmail(opts: { url: string }) {
	return {
		subject: 'Reset your ADSAT Ops password',
		html: wrap(
			'Password reset',
			`<h1 style="margin:0 0 8px;font-size:20px">Reset your password</h1>
<p>We received a request to reset your ADSAT Ops password. The link expires in 1 hour.</p>
<p style="margin:24px 0"><a href="${opts.url}" style="background:#0a0a0a;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
<p style="color:#666;font-size:13px">If you didn't request a reset, ignore this email — your password won't change.</p>
<p style="color:#666;font-size:13px">Or copy this link: <br><a href="${opts.url}">${opts.url}</a></p>`
		),
		text: `Reset your ADSAT Ops password: ${opts.url}\n\nThe link expires in 1 hour. If you didn't request this, ignore the email.`
	};
}
