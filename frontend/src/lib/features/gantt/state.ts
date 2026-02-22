import type { CreateTaskInput, Task } from '$lib/tasksRepo';
import { UNASSIGNED_ASSIGNEE, type TaskFilters } from './filterStorage';
import type { TaskDateRange } from './types';

export type TaskFormInput = {
	title: string;
	note: string;
	startDate: string;
	endDate: string;
	progress: number;
	assigneeIds: string[];
	predecessorTaskId: string;
};

export function orderTasksForDisplay(tasks: Task[]): Task[] {
	return [...tasks].sort(
		(a, b) => a.sortOrder - b.sortOrder || a.startDate.localeCompare(b.startDate)
	);
}

export function hasActiveTaskFilters(filters: TaskFilters): boolean {
	return (
		filters.query.trim().length > 0 ||
		filters.assignee.trim().length > 0 ||
		filters.status !== 'all' ||
		filters.rangeStart.trim().length > 0 ||
		filters.rangeEnd.trim().length > 0
	);
}

export function filterTasksByFilters(tasks: Task[], filters: TaskFilters): Task[] {
	const tokens = filters.query
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter((token) => token.length > 0);
	const assignee = filters.assignee.trim();

	let rangeStart = filters.rangeStart.trim();
	let rangeEnd = filters.rangeEnd.trim();
	if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
		[rangeStart, rangeEnd] = [rangeEnd, rangeStart];
	}

	return tasks.filter((task) => {
		if (tokens.length > 0) {
			const title = task.title.toLowerCase();
			for (const token of tokens) {
				if (!title.includes(token)) {
					return false;
				}
			}
		}

		if (filters.status === 'complete') {
			if (task.progress < 100) {
				return false;
			}
		} else if (filters.status === 'incomplete') {
			if (task.progress >= 100) {
				return false;
			}
		}

		if (assignee.length > 0) {
			if (assignee === UNASSIGNED_ASSIGNEE) {
				if (task.assigneeIds.length > 0) {
					return false;
				}
			} else if (!task.assigneeIds.includes(assignee)) {
				return false;
			}
		}

		if (rangeStart.length > 0 && task.endDate < rangeStart) {
			return false;
		}
		if (rangeEnd.length > 0 && task.startDate > rangeEnd) {
			return false;
		}

		return true;
	});
}

export function ensureSelectedTaskId(tasks: Task[], selectedTaskId: string | null): string | null {
	if (tasks.length === 0) {
		return null;
	}
	if (!selectedTaskId || !tasks.some((task) => task.id === selectedTaskId)) {
		return tasks[0].id;
	}
	return selectedTaskId;
}

export function indexTasksById(tasks: Task[]): ReadonlyMap<string, Task> {
	const index = new Map<string, Task>();
	for (const task of tasks) {
		index.set(task.id, task);
	}
	return index;
}

type TaskLookup =
	| Readonly<Record<string, Task | undefined>>
	| ReadonlyMap<string, Task | undefined>;

function isTaskLookupMap(taskById: TaskLookup): taskById is ReadonlyMap<string, Task | undefined> {
	return taskById instanceof Map;
}

export function trimTaskDatePreviews(
	taskDatePreviews: Record<string, TaskDateRange>,
	visibleTasks: Task[]
): Record<string, TaskDateRange> {
	const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
	const previewTaskIds = Object.keys(taskDatePreviews);
	if (!previewTaskIds.some((taskId) => !visibleTaskIds.has(taskId))) {
		return taskDatePreviews;
	}

	const nextPreviews: Record<string, TaskDateRange> = {};
	for (const taskId of previewTaskIds) {
		if (visibleTaskIds.has(taskId)) {
			nextPreviews[taskId] = taskDatePreviews[taskId];
		}
	}
	return nextPreviews;
}

export function reorderTaskIds(
	orderedTasks: Task[],
	sourceTaskId: string,
	targetTaskId: string
): string[] | null {
	if (sourceTaskId === targetTaskId) {
		return [];
	}

	const nextOrdered = [...orderedTasks];
	const fromIndex = nextOrdered.findIndex((task) => task.id === sourceTaskId);
	const toIndex = nextOrdered.findIndex((task) => task.id === targetTaskId);

	if (fromIndex < 0 || toIndex < 0) {
		return null;
	}

	const [moved] = nextOrdered.splice(fromIndex, 1);
	nextOrdered.splice(toIndex, 0, moved);
	return nextOrdered.map((task) => task.id);
}

export function validateTaskForm(form: TaskFormInput): string | null {
	if (form.title.trim().length === 0) {
		return 'タイトルは必須です。';
	}
	if (form.startDate > form.endDate) {
		return '開始日は終了日以前にしてください。';
	}
	if (!Number.isFinite(form.progress) || form.progress < 0 || form.progress > 100) {
		return '進捗は0から100の範囲で入力してください。';
	}
	return null;
}

export function toCreateTaskInput(form: TaskFormInput): CreateTaskInput {
	return {
		title: form.title.trim(),
		note: form.note,
		startDate: form.startDate,
		endDate: form.endDate,
		progress: form.progress,
		assigneeIds: [...form.assigneeIds],
		predecessorTaskId: form.predecessorTaskId || null
	};
}

export function toggleAssignee(assigneeIds: string[], userId: string): string[] {
	if (assigneeIds.includes(userId)) {
		return assigneeIds.filter((id) => id !== userId);
	}
	return [...assigneeIds, userId];
}

export function hasDependencyViolation(task: Task, taskById: TaskLookup): boolean {
	if (!task.predecessorTaskId) {
		return false;
	}
	const predecessor = isTaskLookupMap(taskById)
		? taskById.get(task.predecessorTaskId)
		: taskById[task.predecessorTaskId];
	if (!predecessor) {
		return true;
	}
	return task.startDate < predecessor.endDate;
}
