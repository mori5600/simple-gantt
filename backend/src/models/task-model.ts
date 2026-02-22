import type { Prisma as PrismaType } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from './db';
import {
	taskInclude,
	type DbClient,
	type PredecessorTaskRecord,
	type TaskWithAssignees
} from './tasks/types';

export { taskInclude };
export type { DbClient, PredecessorTaskRecord, TaskWithAssignees };

export type TaskRecord = {
	id: string;
	projectId: string;
	title: string;
	note: string;
	startDate: string;
	endDate: string;
	progress: number;
	sortOrder: number;
	predecessorTaskId: string | null;
	updatedAt: Date;
};

export type TaskHistoryAction = 'created' | 'updated' | 'deleted';

export type TaskHistoryRecord = {
	id: string;
	taskId: string;
	projectId: string;
	action: TaskHistoryAction;
	changedFields: string[];
	title: string;
	note: string;
	startDate: string;
	endDate: string;
	progress: number;
	assigneeIds: string[];
	predecessorTaskId: string | null;
	createdAt: Date;
};

type TaskHistoryDelegate = {
	create: (args: {
		data: {
			id: string;
			taskId: string;
			projectId: string;
			action: string;
			changedFields: string;
			title: string;
			note: string;
			startDate: string;
			endDate: string;
			progress: number;
			assigneeIds: string;
			predecessorTaskId: string | null;
		};
	}) => Promise<{
		id: string;
		taskId: string;
		projectId: string;
		action: string;
		changedFields: string;
		title: string;
		note: string;
		startDate: string;
		endDate: string;
		progress: number;
		assigneeIds: string;
		predecessorTaskId: string | null;
		createdAt: Date;
	}>;
	findMany: (args: {
		where: {
			projectId: string;
			taskId: string;
		};
		orderBy: Array<{
			createdAt?: 'desc' | 'asc';
			id?: 'desc' | 'asc';
		}>;
	}) => Promise<
		Array<{
			id: string;
			taskId: string;
			projectId: string;
			action: string;
			changedFields: string;
			title: string;
			note: string;
			startDate: string;
			endDate: string;
			progress: number;
			assigneeIds: string;
			predecessorTaskId: string | null;
			createdAt: Date;
		}>
	>;
};

export async function findProjectById(
	projectId: string,
	db: DbClient = prisma
): Promise<{ id: string } | null> {
	return db.project.findUnique({
		where: {
			id: projectId
		},
		select: {
			id: true
		}
	});
}

export async function listTasksByProjectId(
	projectId: string,
	db: DbClient = prisma
): Promise<TaskWithAssignees[]> {
	return db.task.findMany({
		where: {
			projectId
		},
		include: taskInclude,
		orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }, { id: 'asc' }]
	});
}

export async function createTaskRecord(
	params: {
		id: string;
		projectId: string;
		title: string;
		note: string;
		startDate: string;
		endDate: string;
		progress: number;
		sortOrder: number;
		predecessorTaskId: string | null;
	},
	db: DbClient = prisma
): Promise<TaskRecord> {
	const created = await db.task.create({
		data: {
			id: params.id,
			projectId: params.projectId,
			title: params.title,
			note: params.note,
			startDate: params.startDate,
			endDate: params.endDate,
			progress: params.progress,
			sortOrder: params.sortOrder,
			predecessorTaskId: params.predecessorTaskId
		}
	});

	return {
		id: created.id,
		projectId: created.projectId,
		title: created.title,
		note: created.note,
		startDate: created.startDate,
		endDate: created.endDate,
		progress: created.progress,
		sortOrder: created.sortOrder,
		predecessorTaskId: created.predecessorTaskId,
		updatedAt: created.updatedAt
	};
}

export async function createTaskAssignees(
	taskId: string,
	userIds: string[],
	db: DbClient = prisma
): Promise<void> {
	if (userIds.length === 0) {
		return;
	}

	await db.taskAssignee.createMany({
		data: userIds.map((userId) => ({
			taskId,
			userId
		}))
	});
}

function parseStringArrayOrEmpty(value: string): string[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((item): item is string => typeof item === 'string');
	} catch {
		return [];
	}
}

function toTaskHistoryRecord(row: {
	id: string;
	taskId: string;
	projectId: string;
	action: string;
	changedFields: string;
	title: string;
	note: string;
	startDate: string;
	endDate: string;
	progress: number;
	assigneeIds: string;
	predecessorTaskId: string | null;
	createdAt: Date;
}): TaskHistoryRecord {
	return {
		id: row.id,
		taskId: row.taskId,
		projectId: row.projectId,
		action: row.action as TaskHistoryAction,
		changedFields: parseStringArrayOrEmpty(row.changedFields),
		title: row.title,
		note: row.note,
		startDate: row.startDate,
		endDate: row.endDate,
		progress: row.progress,
		assigneeIds: parseStringArrayOrEmpty(row.assigneeIds),
		predecessorTaskId: row.predecessorTaskId,
		createdAt: row.createdAt
	};
}

export async function createTaskHistoryRecord(
	params: {
		taskId: string;
		projectId: string;
		action: TaskHistoryAction;
		changedFields: string[];
		title: string;
		note: string;
		startDate: string;
		endDate: string;
		progress: number;
		assigneeIds: string[];
		predecessorTaskId: string | null;
	},
	db: DbClient = prisma
): Promise<TaskHistoryRecord | null> {
	const delegate = resolveTaskHistoryDelegate(db);
	if (!delegate) {
		return null;
	}

	try {
		const created = await delegate.create({
			data: {
				id: crypto.randomUUID(),
				taskId: params.taskId,
				projectId: params.projectId,
				action: params.action,
				changedFields: JSON.stringify(params.changedFields),
				title: params.title,
				note: params.note,
				startDate: params.startDate,
				endDate: params.endDate,
				progress: params.progress,
				assigneeIds: JSON.stringify(params.assigneeIds),
				predecessorTaskId: params.predecessorTaskId
			}
		});

		return toTaskHistoryRecord(created);
	} catch (error) {
		if (isMissingTableError(error)) {
			logger.warn({ err: error }, 'taskHistory table is missing; skip history logging');
			return null;
		}
		throw error;
	}
}

export async function listTaskHistoryByTaskIdInProject(
	projectId: string,
	taskId: string,
	db: DbClient = prisma
): Promise<TaskHistoryRecord[]> {
	const delegate = resolveTaskHistoryDelegate(db);
	if (!delegate) {
		return [];
	}

	try {
		const rows = await delegate.findMany({
			where: {
				projectId,
				taskId
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
		});
		return rows.map(toTaskHistoryRecord);
	} catch (error) {
		if (isMissingTableError(error)) {
			logger.warn({ err: error }, 'taskHistory table is missing; return empty history');
			return [];
		}
		throw error;
	}
}

function resolveTaskHistoryDelegate(db: DbClient): TaskHistoryDelegate | null {
	const maybeDb = db as unknown as { taskHistory?: TaskHistoryDelegate };
	const delegate = maybeDb.taskHistory;
	if (!delegate) {
		return null;
	}
	if (typeof delegate.create !== 'function' || typeof delegate.findMany !== 'function') {
		return null;
	}
	return delegate;
}

function isMissingTableError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}
	const maybe = error as { code?: unknown };
	return maybe.code === 'P2021';
}

export async function findTaskByIdInProject(
	projectId: string,
	taskId: string,
	db: DbClient = prisma
): Promise<TaskWithAssignees | null> {
	return db.task.findFirst({
		where: {
			id: taskId,
			projectId
		},
		include: taskInclude
	});
}

export async function findTaskByIdOrThrow(
	taskId: string,
	db: DbClient = prisma
): Promise<TaskWithAssignees> {
	return db.task.findUniqueOrThrow({
		where: {
			id: taskId
		},
		include: taskInclude
	});
}

export async function findTaskPredecessorInProject(
	projectId: string,
	taskId: string,
	db: DbClient = prisma
): Promise<PredecessorTaskRecord | null> {
	return db.task.findFirst({
		where: {
			id: taskId,
			projectId
		},
		select: {
			id: true,
			predecessorTaskId: true
		}
	});
}

export async function countUsersByIds(userIds: string[], db: DbClient = prisma): Promise<number> {
	if (userIds.length === 0) {
		return 0;
	}

	return db.user.count({
		where: {
			id: {
				in: userIds
			}
		}
	});
}

export async function nextTaskSortOrder(projectId: string, db: DbClient = prisma): Promise<number> {
	const result = await db.task.aggregate({
		where: {
			projectId
		},
		_max: {
			sortOrder: true
		}
	});

	return (result._max.sortOrder ?? -1) + 1;
}

export async function updateTaskWhereUpdatedAt(
	params: {
		projectId: string;
		taskId: string;
		expectedUpdatedAt: Date;
		data: PrismaType.TaskUncheckedUpdateManyInput;
	},
	db: DbClient = prisma
): Promise<number> {
	const updated = await db.task.updateMany({
		where: {
			id: params.taskId,
			projectId: params.projectId,
			updatedAt: params.expectedUpdatedAt
		},
		data: params.data
	});

	return updated.count;
}

export async function updateTaskWithoutLock(
	params: {
		projectId: string;
		taskId: string;
		data: PrismaType.TaskUncheckedUpdateManyInput;
	},
	db: DbClient = prisma
): Promise<number> {
	const updated = await db.task.updateMany({
		where: {
			id: params.taskId,
			projectId: params.projectId
		},
		data: params.data
	});

	return updated.count;
}

export async function findTaskUpdatedAt(
	projectId: string,
	taskId: string,
	db: DbClient = prisma
): Promise<Date | null> {
	const latest = await db.task.findFirst({
		where: {
			id: taskId,
			projectId
		},
		select: {
			updatedAt: true
		}
	});

	return latest?.updatedAt ?? null;
}

export async function replaceTaskAssignees(
	taskId: string,
	userIds: string[],
	db: DbClient = prisma
): Promise<void> {
	await db.taskAssignee.deleteMany({
		where: {
			taskId
		}
	});

	if (userIds.length === 0) {
		return;
	}

	await db.taskAssignee.createMany({
		data: userIds.map((userId) => ({
			taskId,
			userId
		}))
	});
}

export async function deleteTaskByIdInProject(
	projectId: string,
	taskId: string,
	db: DbClient = prisma
): Promise<number> {
	const deleted = await db.task.deleteMany({
		where: {
			id: taskId,
			projectId
		}
	});

	return deleted.count;
}

export async function listTaskIdsByProjectId(
	projectId: string,
	db: DbClient = prisma
): Promise<string[]> {
	return (
		await db.task.findMany({
			where: {
				projectId
			},
			select: {
				id: true
			}
		})
	).map((task) => task.id);
}

export async function updateTaskSortOrder(
	taskId: string,
	sortOrder: number,
	db: DbClient = prisma
): Promise<void> {
	await db.task.update({
		where: {
			id: taskId
		},
		data: {
			sortOrder
		}
	});
}
