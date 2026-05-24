export const NOTIFICATION_TYPES = {
	TASK_ASSIGNED: 'task.assigned',
	TASK_STATUS_CHANGED: 'task.status_changed',
	TASK_DUE_TOMORROW: 'task.due_tomorrow',
	TASK_OVERDUE: 'task.overdue',
	TASK_COMMENT: 'task.comment',
	TASK_MENTION: 'task.mention',
	REPORT_SUBMITTED: 'report.submitted',
	REPORT_NEEDS_REVISION: 'report.needs_revision',
	REPORT_APPROVED: 'report.approved',
	REPORT_COMMENT: 'report.comment',
	REPORT_MENTION: 'report.mention'
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type EventCategory = 'task' | 'report' | 'mention';

export function categoryForType(type: NotificationType): EventCategory {
	if (type === 'task.mention' || type === 'report.mention') return 'mention';
	if (type.startsWith('task.')) return 'task';
	return 'report';
}
