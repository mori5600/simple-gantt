import type { CreateTaskInput, UpdateTaskInput } from '@simple-gantt/shared/tasks';
import type { Prisma as PrismaType } from '@prisma/client';
import {
	countUsersByIds,
	createTaskAssignees,
	createTaskRecord,
	deleteTaskByIdInProject,
	findProjectById,
	findTaskByIdInProject,
	findTaskByIdOrThrow,
	findTaskPredecessorInProject,
	findTaskUpdatedAt,
	listTaskIdsByProjectId,
	listTasksByProjectId,
	nextTaskSortOrder,
	replaceTaskAssignees,
	type TaskWithAssignees,
	updateTaskSortOrder,
	updateTaskWhereUpdatedAt,
	updateTaskWithoutLock,
	type DbClient
} from '../models/task-model';
import { prisma } from '../models/db';

export class TaskModelValidationError extends Error {}
export class ProjectNotFoundError extends Error {}
export class TaskOptimisticLockError extends Error {}

export async function listTasksUseCase(projectId: string): Promise<TaskWithAssignees[]> {
	await assertProjectExists(projectId);
	return listTasksByProjectId(projectId);
}

export async function createTaskUseCase(
	projectId: string,
	payload: CreateTaskInput
): Promise<TaskWithAssignees> {
	return prisma.$transaction(async (tx) => {
		await assertProjectExists(projectId, tx);
		await assertUsersExist(payload.assigneeIds, tx);
		await assertPredecessorConstraints(
			{
				projectId,
				predecessorTaskId: payload.predecessorTaskId
			},
			tx
		);

		const sortOrder = payload.sortOrder ?? (await nextTaskSortOrder(projectId, tx));
		const task = await createTaskRecord(
			{
				id: crypto.randomUUID(),
				projectId,
				title: payload.title,
				note: payload.note,
				startDate: payload.startDate,
				endDate: payload.endDate,
				progress: payload.progress,
				sortOrder,
				predecessorTaskId: payload.predecessorTaskId
			},
			tx
		);

		await createTaskAssignees(task.id, payload.assigneeIds, tx);
		return findTaskByIdOrThrow(task.id, tx);
	});
}

export async function updateTaskUseCase(
	projectId: string,
	taskId: string,
	payload: UpdateTaskInput
): Promise<TaskWithAssignees | null> {
	return prisma.$transaction(async (tx) => {
		await assertProjectExists(projectId, tx);

		const existing = await findTaskByIdInProject(projectId, taskId, tx);
		if (!existing) {
			return null;
		}

		const expectedUpdatedAt = new Date(payload.updatedAt);
		if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
			throw new TaskOptimisticLockError(
				'task は他ユーザーによって更新されました。再読み込みして再度お試しください。'
			);
		}

		const nextTitle = payload.title ?? existing.title;
		const nextNote = payload.note ?? existing.note;
		const nextStartDate = payload.startDate ?? existing.startDate;
		const nextEndDate = payload.endDate ?? existing.endDate;
		if (nextStartDate > nextEndDate) {
			throw new TaskModelValidationError('startDate は endDate 以下にしてください。');
		}
		const nextProgress = payload.progress ?? existing.progress;
		const nextSortOrder = payload.sortOrder ?? existing.sortOrder;
		const nextPredecessorTaskId =
			payload.predecessorTaskId !== undefined
				? payload.predecessorTaskId
				: existing.predecessorTaskId;
		const existingAssigneeIds = existing.assignees.map((assignee) => assignee.userId);
		const nextAssigneeIds = payload.assigneeIds ?? existingAssigneeIds;
		const assigneeIdsChanged =
			payload.assigneeIds !== undefined && !isSameIdList(existingAssigneeIds, nextAssigneeIds);
		const taskFieldsChanged =
			nextTitle !== existing.title ||
			nextNote !== existing.note ||
			nextStartDate !== existing.startDate ||
			nextEndDate !== existing.endDate ||
			nextProgress !== existing.progress ||
			nextSortOrder !== existing.sortOrder ||
			nextPredecessorTaskId !== existing.predecessorTaskId;

		if (payload.assigneeIds !== undefined) {
			await assertUsersExist(payload.assigneeIds, tx);
		}

		await assertPredecessorConstraints(
			{
				projectId,
				taskId,
				predecessorTaskId: nextPredecessorTaskId
			},
			tx
		);

		if (!taskFieldsChanged && !assigneeIdsChanged) {
			return existing;
		}

		const updateData: PrismaType.TaskUncheckedUpdateManyInput = taskFieldsChanged
			? {
					title: nextTitle,
					note: nextNote,
					startDate: nextStartDate,
					endDate: nextEndDate,
					progress: nextProgress,
					sortOrder: nextSortOrder,
					predecessorTaskId: nextPredecessorTaskId
				}
			: {
					// Relation-only updates must still advance optimistic-lock token.
					updatedAt: new Date()
				};

		const updatedCount = await updateTaskWhereUpdatedAt(
			{
				projectId,
				taskId,
				expectedUpdatedAt,
				data: updateData
			},
			tx
		);

		if (updatedCount === 0) {
			const latestUpdatedAt = await findTaskUpdatedAt(projectId, taskId, tx);
			if (!latestUpdatedAt) {
				return null;
			}

			if (latestUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
				throw new TaskOptimisticLockError(
					'task は他ユーザーによって更新されました。再読み込みして再度お試しください。'
				);
			}

			const fallbackUpdatedCount = await updateTaskWithoutLock(
				{
					projectId,
					taskId,
					data: updateData
				},
				tx
			);

			if (fallbackUpdatedCount === 0) {
				return null;
			}
		}

		if (assigneeIdsChanged) {
			await replaceTaskAssignees(taskId, nextAssigneeIds, tx);
		}

		return findTaskByIdOrThrow(taskId, tx);
	});
}

export async function deleteTaskUseCase(projectId: string, taskId: string): Promise<boolean> {
	await assertProjectExists(projectId);
	const deletedCount = await deleteTaskByIdInProject(projectId, taskId);
	return deletedCount > 0;
}

export async function reorderTasksUseCase(
	projectId: string,
	ids: string[]
): Promise<TaskWithAssignees[]> {
	await assertProjectExists(projectId);

	await prisma.$transaction(async (tx) => {
		const taskIds = new Set(await listTaskIdsByProjectId(projectId, tx));
		if (taskIds.size !== ids.length) {
			throw new TaskModelValidationError('ids の件数が task 件数と一致しません。');
		}

		for (const id of ids) {
			if (!taskIds.has(id)) {
				throw new TaskModelValidationError(`task not found: ${id}`);
			}
		}

		for (const [index, id] of ids.entries()) {
			await updateTaskSortOrder(id, index, tx);
		}
	});

	return listTasksByProjectId(projectId);
}

function normalizeIdList(values: string[]): string[] {
	return [...new Set(values)].sort();
}

function isSameIdList(left: string[], right: string[]): boolean {
	const normalizedLeft = normalizeIdList(left);
	const normalizedRight = normalizeIdList(right);
	if (normalizedLeft.length !== normalizedRight.length) {
		return false;
	}

	for (let index = 0; index < normalizedLeft.length; index += 1) {
		if (normalizedLeft[index] !== normalizedRight[index]) {
			return false;
		}
	}

	return true;
}

async function assertUsersExist(userIds: string[], db: DbClient = prisma): Promise<void> {
	if (userIds.length === 0) {
		return;
	}

	const count = await countUsersByIds(userIds, db);
	if (count !== userIds.length) {
		throw new TaskModelValidationError('assigneeIds に存在しない user が含まれます。');
	}
}

async function assertProjectExists(projectId: string, db: DbClient = prisma): Promise<void> {
	const project = await findProjectById(projectId, db);
	if (!project) {
		throw new ProjectNotFoundError(`project not found: ${projectId}`);
	}
}

async function assertNoDependencyCycle(
	params: {
		projectId: string;
		taskId: string;
		predecessorTaskId: string;
	},
	db: DbClient = prisma
): Promise<void> {
	const seen = new Set<string>([params.taskId]);
	let cursor: string | null = params.predecessorTaskId;

	while (cursor) {
		if (seen.has(cursor)) {
			throw new TaskModelValidationError('依存関係が循環しています。');
		}

		seen.add(cursor);
		const next = await findTaskPredecessorInProject(params.projectId, cursor, db);
		if (!next) {
			return;
		}
		cursor = next.predecessorTaskId;
	}
}

async function assertPredecessorConstraints(
	params: {
		projectId: string;
		taskId?: string;
		predecessorTaskId: string | null;
	},
	db: DbClient = prisma
): Promise<void> {
	const { projectId, taskId, predecessorTaskId } = params;

	if (!predecessorTaskId) {
		return;
	}

	if (taskId && predecessorTaskId === taskId) {
		throw new TaskModelValidationError('先行タスクに自分自身は指定できません。');
	}

	const predecessor = await findTaskPredecessorInProject(projectId, predecessorTaskId, db);
	if (!predecessor) {
		throw new TaskModelValidationError('先行タスクが見つかりません。');
	}

	if (taskId) {
		await assertNoDependencyCycle(
			{
				projectId,
				taskId,
				predecessorTaskId
			},
			db
		);
	}
}
