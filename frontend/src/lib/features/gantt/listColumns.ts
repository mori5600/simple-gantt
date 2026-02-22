import type { Task, User } from '$lib/tasksRepo';
import type { ListColumnWidths } from './types';

export const LIST_COLUMN_MIN_WIDTHS: ListColumnWidths = [140, 120, 96, 96, 120];

export const LIST_COLUMN_DEFAULT_WIDTHS: ListColumnWidths = [220, 170, 112, 112, 132];

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function normalizeListColumnWidths(nextWidths: ListColumnWidths): ListColumnWidths {
	return nextWidths.map((width, index) =>
		Math.max(LIST_COLUMN_MIN_WIDTHS[index], Math.round(width))
	) as ListColumnWidths;
}

export function getAssigneeNames(task: Task, users: readonly User[]): string[] {
	return task.assigneeIds
		.map((id) => users.find((user) => user.id === id)?.name ?? id)
		.filter(Boolean);
}

export function getAssigneeSummary(task: Task, users: readonly User[]): string {
	const names = getAssigneeNames(task, users);
	if (names.length === 0) {
		return '未割り当て';
	}
	return names.join(', ');
}

export function computeAutoColumnWidths(
	sourceTasks: readonly Task[],
	users: readonly User[]
): ListColumnWidths {
	const taskChars = Math.max(4, ...sourceTasks.map((task) => task.title.length));
	const assigneeChars = Math.max(
		6,
		...sourceTasks.map((task) => getAssigneeSummary(task, users).length),
		...sourceTasks.map((task) => getAssigneeNames(task, users).join(', ').length)
	);

	const taskWidth = clamp(Math.round(taskChars * 8.2) + 40, 160, 420);
	const assignWidth = clamp(Math.round(assigneeChars * 7.2) + 36, 130, 320);
	const startWidth = 112;
	const endWidth = 112;
	const progressWidth = 132;

	return [taskWidth, assignWidth, startWidth, endWidth, progressWidth];
}
