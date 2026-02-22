import type { CreateTaskInput, UpdateTaskInput } from '@simple-gantt/shared/tasks';
import type { Prisma as PrismaType } from '@prisma/client';
import {
	countUsersByIds,
	createTaskAssignees,
	createTaskHistoryRecord,
	createTaskRecord,
	deleteTaskByIdInProject,
	findProjectById,
	findTaskByIdInProject,
	findTaskByIdOrThrow,
	findTaskPredecessorInProject,
	findTaskUpdatedAt,
	listTaskIdsByProjectId,
	listTaskHistoryByTaskIdInProject,
	listTasksByProjectId,
	nextTaskSortOrder,
	replaceTaskAssignees,
	type TaskHistoryRecord,
	type TaskWithAssignees,
	updateTaskSortOrder,
	updateTaskWhereUpdatedAt,
	updateTaskWithoutLock,
	type DbClient
} from '../models/task-model';
import { prisma } from '../models/db';

/**
 * task 操作で検出した業務ルール違反を、実行時障害と分離して扱うための例外。
 */
export class TaskModelValidationError extends Error {}
/**
 * task 操作時に親 project の存在を前提化するための例外。
 * project 不在時に「空データ」と誤解されるのを防ぐ。
 */
export class ProjectNotFoundError extends Error {}
/**
 * 同一 task の同時更新で更新ロストが起きるのを防ぐ楽観ロック例外。
 */
export class TaskOptimisticLockError extends Error {}

/**
 * project が存在することを保証したうえで task 一覧を返す。
 * 存在しない project と「task が 0 件」を明確に区別するための入口。
 */
export async function listTasksUseCase(projectId: string): Promise<TaskWithAssignees[]> {
	await assertProjectExists(projectId);
	return listTasksByProjectId(projectId);
}

/**
 * task 本体・担当者関連・依存関係を 1 トランザクションで確定し、
 * 中途半端な作成状態を残さないようにする。
 */
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
		const created = await findTaskByIdOrThrow(task.id, tx);
		await createTaskHistoryRecord(
			{
				taskId: created.id,
				projectId: created.projectId,
				action: 'created',
				changedFields: [
					'title',
					'note',
					'startDate',
					'endDate',
					'progress',
					'assigneeIds',
					'predecessorTaskId'
				],
				title: created.title,
				note: created.note,
				startDate: created.startDate,
				endDate: created.endDate,
				progress: created.progress,
				assigneeIds: created.assignees.map((assignee) => assignee.userId),
				predecessorTaskId: created.predecessorTaskId
			},
			tx
		);
		return created;
	});
}

/**
 * 楽観ロックと業務制約検証をまとめて適用し、
 * 同時更新と不正な依存関係の双方から task を保護する。
 */
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
		const changedFields: string[] = [];
		const taskFieldsChanged =
			nextTitle !== existing.title ||
			nextNote !== existing.note ||
			nextStartDate !== existing.startDate ||
			nextEndDate !== existing.endDate ||
			nextProgress !== existing.progress ||
			nextSortOrder !== existing.sortOrder ||
			nextPredecessorTaskId !== existing.predecessorTaskId;
		if (nextTitle !== existing.title) {
			changedFields.push('title');
		}
		if (nextNote !== existing.note) {
			changedFields.push('note');
		}
		if (nextStartDate !== existing.startDate) {
			changedFields.push('startDate');
		}
		if (nextEndDate !== existing.endDate) {
			changedFields.push('endDate');
		}
		if (nextProgress !== existing.progress) {
			changedFields.push('progress');
		}
		if (nextSortOrder !== existing.sortOrder) {
			changedFields.push('sortOrder');
		}
		if (nextPredecessorTaskId !== existing.predecessorTaskId) {
			changedFields.push('predecessorTaskId');
		}
		if (assigneeIdsChanged) {
			changedFields.push('assigneeIds');
		}

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

		const updated = await findTaskByIdOrThrow(taskId, tx);
		await createTaskHistoryRecord(
			{
				taskId: updated.id,
				projectId: updated.projectId,
				action: 'updated',
				changedFields,
				title: updated.title,
				note: updated.note,
				startDate: updated.startDate,
				endDate: updated.endDate,
				progress: updated.progress,
				assigneeIds: updated.assignees.map((assignee) => assignee.userId),
				predecessorTaskId: updated.predecessorTaskId
			},
			tx
		);

		return updated;
	});
}

/**
 * task 削除を idempotent に扱い、呼び出し側が存在有無を真偽値で判定できるようにする。
 */
export async function deleteTaskUseCase(projectId: string, taskId: string): Promise<boolean> {
	return prisma.$transaction(async (tx) => {
		await assertProjectExists(projectId, tx);
		const existing = await findTaskByIdInProject(projectId, taskId, tx);
		if (!existing) {
			return false;
		}

		const deletedCount = await deleteTaskByIdInProject(projectId, taskId, tx);
		if (deletedCount === 0) {
			return false;
		}

		await createTaskHistoryRecord(
			{
				taskId: existing.id,
				projectId: existing.projectId,
				action: 'deleted',
				changedFields: ['deleted'],
				title: existing.title,
				note: existing.note,
				startDate: existing.startDate,
				endDate: existing.endDate,
				progress: existing.progress,
				assigneeIds: existing.assignees.map((assignee) => assignee.userId),
				predecessorTaskId: existing.predecessorTaskId
			},
			tx
		);
		return true;
	});
}

export async function listTaskHistoryUseCase(
	projectId: string,
	taskId: string
): Promise<TaskHistoryRecord[]> {
	await assertProjectExists(projectId);
	return listTaskHistoryByTaskIdInProject(projectId, taskId);
}

/**
 * 並び替え入力を全 task の完全順序として検証してから反映する。
 * 欠落や重複を許すと sortOrder の整合性が壊れるため、全件一致を必須にする。
 */
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

/**
 * ID 配列比較の順序依存を排除するため、重複除去とソートで正規化する。
 */
function normalizeIdList(values: string[]): string[] {
	return [...new Set(values)].sort();
}

/**
 * 担当者更新で不要な書き換えを避けるため、集合として同一かを判定する。
 */
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

/**
 * 不正 userId の混入を task 更新時点で遮断し、担当者関連の整合性を守る。
 */
async function assertUsersExist(userIds: string[], db: DbClient = prisma): Promise<void> {
	if (userIds.length === 0) {
		return;
	}

	const count = await countUsersByIds(userIds, db);
	if (count !== userIds.length) {
		throw new TaskModelValidationError('assigneeIds に存在しない user が含まれます。');
	}
}

/**
 * project を前提とする task ユースケースで、誤った projectId を早期に検出する。
 */
async function assertProjectExists(projectId: string, db: DbClient = prisma): Promise<void> {
	const project = await findProjectById(projectId, db);
	if (!project) {
		throw new ProjectNotFoundError(`project not found: ${projectId}`);
	}
}

/**
 * 先行タスクの連鎖を辿って循環参照を検知し、スケジュール計算不能な状態を防ぐ。
 */
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

/**
 * 先行タスク制約を一箇所で検証し、
 * 「自己参照」「存在しない参照」「循環参照」を更新前に排除する。
 */
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
