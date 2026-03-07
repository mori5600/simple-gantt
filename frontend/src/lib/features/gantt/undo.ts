import type { Task, UpdateTaskInput } from '$lib/data/tasks/repo';

export type UndoTaskUpdate = {
	previousTask: Task;
	appliedUpdatedAt: string;
};

export function cloneTaskForUndo(task: Task): Task {
	return {
		...task,
		assigneeIds: [...task.assigneeIds]
	};
}

export function buildTaskRestoreInput(task: Task, updatedAt: string): UpdateTaskInput {
	return {
		title: task.title,
		note: task.note,
		startDate: task.startDate,
		endDate: task.endDate,
		progress: task.progress,
		assigneeIds: [...task.assigneeIds],
		predecessorTaskId: task.predecessorTaskId,
		updatedAt
	};
}
