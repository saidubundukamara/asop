import { createHmac } from 'node:crypto';
import { sendEmail } from './send';
import type { NotificationType } from '$lib/server/notifications/types';

const APP_URL = process.env.PUBLIC_APP_URL ?? 'http://localhost:5173';
const SECRET = process.env.BETTER_AUTH_SECRET ?? 'dev-secret';

function wrap(title: string, bodyHtml: string, unsubscribeUrl?: string): string {
	const footer = unsubscribeUrl
		? `<p style="color:#888;font-size:12px;margin-top:8px"><a href="${unsubscribeUrl}" style="color:#888">Unsubscribe from this type of email</a></p>`
		: '';
	return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;max-width:560px;margin:24px auto;padding:24px;">
${bodyHtml}
<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="color:#888;font-size:12px">ADSAT Staff Operations Platform · ${APP_URL}</p>
${footer}
</body></html>`;
}

function cta(label: string, url: string): string {
	return `<p style="margin:24px 0"><a href="${url}" style="background:#0a0a0a;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;
}

function unsubscribeToken(userId: string, channel: string, category: string): string {
	const payload = `${userId}:${channel}:${category}`;
	const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
	return encodeURIComponent(`${payload}:${sig}`);
}

export function buildUnsubscribeUrl(userId: string, category: string): string {
	const token = unsubscribeToken(userId, 'email', category);
	return `${APP_URL}/api/notifications/unsubscribe?token=${token}`;
}

// Verifies a token from the unsubscribe link. Returns parsed fields or null.
export function verifyUnsubscribeToken(
	raw: string
): { userId: string; channel: string; category: string } | null {
	try {
		const decoded = decodeURIComponent(raw);
		const lastColon = decoded.lastIndexOf(':');
		const payload = decoded.slice(0, lastColon);
		const sig = decoded.slice(lastColon + 1);
		const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
		if (sig !== expected) return null;
		const [userId, channel, category] = payload.split(':');
		if (!userId || !channel || !category) return null;
		return { userId, channel, category };
	} catch {
		return null;
	}
}

type SendNotifEmailOpts = {
	to: string;
	recipientId: string;
	type: NotificationType;
	title: string;
	body: string;
	deepLink?: string;
};

export async function sendNotificationEmail(opts: SendNotifEmailOpts): Promise<void> {
	const link = opts.deepLink ? `${APP_URL}${opts.deepLink}` : APP_URL;
	const category = opts.type.startsWith('task')
		? 'task'
		: opts.type.startsWith('report')
			? 'report'
			: 'mention';
	const unsubUrl = buildUnsubscribeUrl(opts.recipientId, category);

	let subject: string;
	let bodyHtml: string;
	let text: string;

	switch (opts.type) {
		case 'task.assigned':
			subject = `New task assigned: ${opts.title}`;
			bodyHtml = wrap(
				subject,
				`<h1 style="margin:0 0 8px;font-size:20px">New task assigned to you</h1>
<p>${opts.body}</p>
${cta('View task', link)}`,
				unsubUrl
			);
			text = `New task assigned: ${opts.body}\n\n${link}`;
			break;

		case 'task.status_changed':
			subject = `Task updated: ${opts.title}`;
			bodyHtml = wrap(
				subject,
				`<h1 style="margin:0 0 8px;font-size:20px">Task status changed</h1>
<p>${opts.body}</p>
${cta('View task', link)}`,
				unsubUrl
			);
			text = `Task status changed: ${opts.body}\n\n${link}`;
			break;

		case 'task.due_tomorrow':
			subject = `Due tomorrow: ${opts.title}`;
			bodyHtml = wrap(
				subject,
				`<h1 style="margin:0 0 8px;font-size:20px">Task due tomorrow</h1>
<p>${opts.body}</p>
${cta('View task', link)}`,
				unsubUrl
			);
			text = `Due tomorrow: ${opts.body}\n\n${link}`;
			break;

		case 'task.overdue':
			subject = `Overdue task: ${opts.title}`;
			bodyHtml = wrap(
				subject,
				`<h1 style="margin:0 0 8px;font-size:20px">You have an overdue task</h1>
<p>${opts.body}</p>
${cta('View task', link)}`,
				unsubUrl
			);
			text = `Overdue: ${opts.body}\n\n${link}`;
			break;

		case 'task.comment':
		case 'task.mention':
			subject = `New comment on task: ${opts.title}`;
			bodyHtml = wrap(
				subject,
				`<h1 style="margin:0 0 8px;font-size:20px">${opts.type === 'task.mention' ? 'You were mentioned' : 'New comment'} on a task</h1>
<p>${opts.body}</p>
${cta('View comment', link)}`,
				unsubUrl
			);
			text = `${opts.body}\n\n${link}`;
			break;

		case 'report.submitted':
			subject = `Report submitted for review: ${opts.title}`;
			bodyHtml = wrap(
				subject,
				`<h1 style="margin:0 0 8px;font-size:20px">A report needs your review</h1>
<p>${opts.body}</p>
${cta('Review report', link)}`,
				unsubUrl
			);
			text = `Report submitted: ${opts.body}\n\n${link}`;
			break;

		case 'report.needs_revision':
			subject = `Report needs revision: ${opts.title}`;
			bodyHtml = wrap(
				subject,
				`<h1 style="margin:0 0 8px;font-size:20px">Your report needs revision</h1>
<p>${opts.body}</p>
${cta('View report', link)}`,
				unsubUrl
			);
			text = `Needs revision: ${opts.body}\n\n${link}`;
			break;

		case 'report.approved':
			subject = `Report approved: ${opts.title}`;
			bodyHtml = wrap(
				subject,
				`<h1 style="margin:0 0 8px;font-size:20px">Your report has been approved</h1>
<p>${opts.body}</p>
${cta('View report', link)}`,
				unsubUrl
			);
			text = `Approved: ${opts.body}\n\n${link}`;
			break;

		case 'report.comment':
		case 'report.mention':
			subject = `New comment on report: ${opts.title}`;
			bodyHtml = wrap(
				subject,
				`<h1 style="margin:0 0 8px;font-size:20px">${opts.type === 'report.mention' ? 'You were mentioned' : 'New comment'} on a report</h1>
<p>${opts.body}</p>
${cta('View comment', link)}`,
				unsubUrl
			);
			text = `${opts.body}\n\n${link}`;
			break;

		default: {
			const _exhaustive: never = opts.type;
			return _exhaustive;
		}
	}

	await sendEmail({ to: opts.to, subject, html: bodyHtml, text });
}
