import { prisma } from '$lib/server/db';
import { verifyUnsubscribeToken } from '$lib/server/email/notifications';
import type { RequestHandler } from './$types';

// One-click email unsubscribe — no session required. The HMAC token in the
// link proves identity without exposing credentials.
export const GET: RequestHandler = async (event) => {
	const token = event.url.searchParams.get('token') ?? '';
	const parsed = verifyUnsubscribeToken(token);

	if (!parsed) {
		return new Response(errorHtml('Invalid or expired unsubscribe link.'), {
			status: 400,
			headers: { 'content-type': 'text/html' }
		});
	}

	await prisma.notificationPreference.upsert({
		where: {
			userId_channel_eventCategory: {
				userId: parsed.userId,
				channel: parsed.channel,
				eventCategory: parsed.category
			}
		},
		update: { isEnabled: false },
		create: {
			userId: parsed.userId,
			channel: parsed.channel,
			eventCategory: parsed.category,
			isEnabled: false
		}
	});

	return new Response(successHtml(), { headers: { 'content-type': 'text/html' } });
};

function successHtml(): string {
	return `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:64px auto;padding:24px;text-align:center;">
<h1 style="font-size:20px">You've been unsubscribed</h1>
<p>You will no longer receive this type of email notification.</p>
<p>You can re-enable notifications any time in your <a href="${process.env.PUBLIC_APP_URL ?? ''}/profile">profile settings</a>.</p>
</body></html>`;
}

function errorHtml(msg: string): string {
	return `<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:64px auto;padding:24px;text-align:center;">
<h1 style="font-size:20px">Something went wrong</h1>
<p>${msg}</p>
</body></html>`;
}
