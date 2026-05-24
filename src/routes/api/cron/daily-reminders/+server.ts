import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { notify } from '$lib/server/notify';
import { NOTIFICATION_TYPES } from '$lib/server/notifications/types';
import type { RequestHandler } from './$types';

// Vercel Cron: runs daily at 07:00 UTC (see vercel.json).
// Guards against public invocation with a shared secret.
export const GET: RequestHandler = async (event) => {
	const secret = event.request.headers.get('x-cron-secret') ?? '';
	if (secret !== (process.env.CRON_SECRET ?? '')) {
		return new Response('Forbidden', { status: 403 });
	}

	const now = new Date();

	// Tomorrow's window (UTC).
	const tomorrowStart = new Date(now);
	tomorrowStart.setDate(now.getDate() + 1);
	tomorrowStart.setUTCHours(0, 0, 0, 0);
	const tomorrowEnd = new Date(tomorrowStart);
	tomorrowEnd.setDate(tomorrowStart.getDate() + 1);

	const [dueTomorrow, overdue] = await Promise.all([
		prisma.task.findMany({
			where: {
				dueDate: { gte: tomorrowStart, lt: tomorrowEnd },
				status: { notIn: ['completed', 'cancelled'] },
				deletedAt: null
			},
			select: { id: true, title: true, assigneeId: true }
		}),
		prisma.task.findMany({
			where: {
				dueDate: { lt: now },
				status: { notIn: ['completed', 'cancelled'] },
				deletedAt: null
			},
			select: { id: true, title: true, assigneeId: true }
		})
	]);

	await Promise.allSettled([
		...dueTomorrow.map((t) =>
			notify({
				recipientId: t.assigneeId,
				type: NOTIFICATION_TYPES.TASK_DUE_TOMORROW,
				title: 'Task due tomorrow',
				body: t.title,
				deepLink: `/tasks/${t.id}`
			})
		),
		...overdue.map((t) =>
			notify({
				recipientId: t.assigneeId,
				type: NOTIFICATION_TYPES.TASK_OVERDUE,
				title: 'Overdue task',
				body: t.title,
				deepLink: `/tasks/${t.id}`
			})
		)
	]);

	return json({ ok: true, dueTomorrow: dueTomorrow.length, overdue: overdue.length });
};
