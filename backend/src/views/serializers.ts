import type { ProjectRecord } from '../models/project-model';
import type { TaskWithAssignees } from '../models/task-model';
import type { ApiProject, ApiProjectSummary, ApiTask, ApiUser, ApiUserSummary } from './types';

export function toApiUser(user: { id: string; name: string; updatedAt: Date }): ApiUser {
	return {
		id: user.id,
		name: user.name,
		updatedAt: user.updatedAt.toISOString()
	};
}

export function toApiUserSummary(user: {
	id: string;
	name: string;
	updatedAt: Date;
	taskCount: number;
}): ApiUserSummary {
	return {
		id: user.id,
		name: user.name,
		updatedAt: user.updatedAt.toISOString(),
		taskCount: user.taskCount
	};
}

export function toApiProject(project: ProjectRecord): ApiProject {
	return {
		id: project.id,
		name: project.name,
		sortOrder: project.sortOrder,
		updatedAt: project.updatedAt.toISOString()
	};
}

export function toApiProjectSummary(project: {
	id: string;
	name: string;
	sortOrder: number;
	updatedAt: Date;
	taskCount: number;
}): ApiProjectSummary {
	return {
		id: project.id,
		name: project.name,
		sortOrder: project.sortOrder,
		updatedAt: project.updatedAt.toISOString(),
		taskCount: project.taskCount
	};
}

export function toApiTask(task: TaskWithAssignees): ApiTask {
	return {
		id: task.id,
		projectId: task.projectId,
		title: task.title,
		note: task.note,
		startDate: task.startDate,
		endDate: task.endDate,
		progress: task.progress,
		sortOrder: task.sortOrder,
		updatedAt: task.updatedAt.toISOString(),
		assigneeIds: task.assignees.map((assignee) => assignee.userId),
		predecessorTaskId: task.predecessorTaskId
	};
}
