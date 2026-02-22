import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	txMock,
	prismaMock,
	countUsersByIdsMock,
	createTaskAssigneesMock,
	createTaskRecordMock,
	createTaskHistoryRecordMock,
	deleteTaskByIdInProjectMock,
	findProjectByIdMock,
	findTaskByIdInProjectMock,
	findTaskByIdOrThrowMock,
	findTaskPredecessorInProjectMock,
	findTaskUpdatedAtMock,
	listTaskIdsByProjectIdMock,
	listTaskHistoryByTaskIdInProjectMock,
	listTasksByProjectIdMock,
	nextTaskSortOrderMock,
	replaceTaskAssigneesMock,
	updateTaskSortOrderMock,
	updateTaskWhereUpdatedAtMock,
	updateTaskWithoutLockMock
} = vi.hoisted(() => {
	const txMock = { tx: true };
	return {
		txMock,
		prismaMock: {
			$transaction: vi.fn()
		},
		countUsersByIdsMock: vi.fn(),
		createTaskAssigneesMock: vi.fn(),
		createTaskRecordMock: vi.fn(),
		createTaskHistoryRecordMock: vi.fn(),
		deleteTaskByIdInProjectMock: vi.fn(),
		findProjectByIdMock: vi.fn(),
		findTaskByIdInProjectMock: vi.fn(),
		findTaskByIdOrThrowMock: vi.fn(),
		findTaskPredecessorInProjectMock: vi.fn(),
		findTaskUpdatedAtMock: vi.fn(),
		listTaskIdsByProjectIdMock: vi.fn(),
		listTaskHistoryByTaskIdInProjectMock: vi.fn(),
		listTasksByProjectIdMock: vi.fn(),
		nextTaskSortOrderMock: vi.fn(),
		replaceTaskAssigneesMock: vi.fn(),
		updateTaskSortOrderMock: vi.fn(),
		updateTaskWhereUpdatedAtMock: vi.fn(),
		updateTaskWithoutLockMock: vi.fn()
	};
});

vi.mock('../models/db', () => ({
	prisma: prismaMock
}));

vi.mock('../models/task-model', () => ({
	countUsersByIds: countUsersByIdsMock,
	createTaskAssignees: createTaskAssigneesMock,
	createTaskRecord: createTaskRecordMock,
	createTaskHistoryRecord: createTaskHistoryRecordMock,
	deleteTaskByIdInProject: deleteTaskByIdInProjectMock,
	findProjectById: findProjectByIdMock,
	findTaskByIdInProject: findTaskByIdInProjectMock,
	findTaskByIdOrThrow: findTaskByIdOrThrowMock,
	findTaskPredecessorInProject: findTaskPredecessorInProjectMock,
	findTaskUpdatedAt: findTaskUpdatedAtMock,
	listTaskIdsByProjectId: listTaskIdsByProjectIdMock,
	listTaskHistoryByTaskIdInProject: listTaskHistoryByTaskIdInProjectMock,
	listTasksByProjectId: listTasksByProjectIdMock,
	nextTaskSortOrder: nextTaskSortOrderMock,
	replaceTaskAssignees: replaceTaskAssigneesMock,
	updateTaskSortOrder: updateTaskSortOrderMock,
	updateTaskWhereUpdatedAt: updateTaskWhereUpdatedAtMock,
	updateTaskWithoutLock: updateTaskWithoutLockMock
}));

import {
	createTaskUseCase,
	deleteTaskUseCase,
	listTaskHistoryUseCase,
	listTasksUseCase,
	ProjectNotFoundError,
	reorderTasksUseCase,
	TaskModelValidationError,
	TaskOptimisticLockError,
	updateTaskUseCase
} from './task-usecases';

type MockTask = {
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
	assignees: Array<{ userId: string }>;
};

function createTaskFixture(partial: Partial<MockTask> = {}): MockTask {
	return {
		id: 'task-1',
		projectId: 'project-1',
		title: '既存タスク',
		note: '',
		startDate: '2026-02-20',
		endDate: '2026-02-21',
		progress: 10,
		sortOrder: 0,
		predecessorTaskId: null,
		updatedAt: new Date('2026-02-20T00:00:00.000Z'),
		assignees: [{ userId: 'user-1' }],
		...partial
	};
}

describe('task-usecases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
			callback(txMock)
		);
	});

	it('listTasksUseCase should reject when project does not exist', async () => {
		findProjectByIdMock.mockResolvedValueOnce(null);

		await expect(listTasksUseCase('project-missing')).rejects.toBeInstanceOf(ProjectNotFoundError);
		expect(listTasksByProjectIdMock).not.toHaveBeenCalled();
	});

	it('listTasksUseCase should return tasks in project', async () => {
		const rows = [createTaskFixture()];
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		listTasksByProjectIdMock.mockResolvedValueOnce(rows);

		await expect(listTasksUseCase('project-1')).resolves.toEqual(rows);
		expect(listTasksByProjectIdMock).toHaveBeenCalledWith('project-1');
	});

	it('createTaskUseCase should create task with validations', async () => {
		const randomUUIDMock = vi
			.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce('task-uuid');
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		countUsersByIdsMock.mockResolvedValueOnce(1);
		nextTaskSortOrderMock.mockResolvedValueOnce(4);
		createTaskRecordMock.mockResolvedValueOnce({ id: 'task-uuid' });
		findTaskByIdOrThrowMock.mockResolvedValueOnce(
			createTaskFixture({
				id: 'task-uuid',
				title: '新規',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 0,
				sortOrder: 4
			})
		);

		const actual = await createTaskUseCase('project-1', {
			title: '新規',
			note: '',
			startDate: '2026-02-20',
			endDate: '2026-02-21',
			progress: 0,
			assigneeIds: ['user-1'],
			predecessorTaskId: null
		});

		expect(createTaskRecordMock).toHaveBeenCalledWith(
			{
				id: 'task-uuid',
				projectId: 'project-1',
				title: '新規',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 0,
				sortOrder: 4,
				predecessorTaskId: null
			},
			txMock
		);
		expect(createTaskAssigneesMock).toHaveBeenCalledWith('task-uuid', ['user-1'], txMock);
		expect(createTaskHistoryRecordMock).toHaveBeenCalledWith(
			{
				taskId: 'task-uuid',
				projectId: 'project-1',
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
				title: '新規',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 0,
				assigneeIds: ['user-1'],
				predecessorTaskId: null
			},
			txMock
		);
		expect(actual).toEqual(
			createTaskFixture({
				id: 'task-uuid',
				title: '新規',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 0,
				sortOrder: 4
			})
		);
		randomUUIDMock.mockRestore();
	});

	it('updateTaskUseCase should return existing task for no-op update', async () => {
		const existing = createTaskFixture();
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(existing);

		const actual = await updateTaskUseCase('project-1', 'task-1', {
			title: '既存タスク',
			updatedAt: '2026-02-20T00:00:00.000Z'
		});

		expect(actual).toEqual(existing);
		expect(updateTaskWhereUpdatedAtMock).not.toHaveBeenCalled();
		expect(findTaskByIdOrThrowMock).not.toHaveBeenCalled();
	});

	it('updateTaskUseCase should fallback-update when lock update count is zero', async () => {
		const existing = createTaskFixture();
		const updated = createTaskFixture({
			title: '更新後タスク',
			updatedAt: new Date('2026-02-21T00:00:00.000Z')
		});
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(existing);
		updateTaskWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findTaskUpdatedAtMock.mockResolvedValueOnce(new Date('2026-02-20T00:00:00.000Z'));
		updateTaskWithoutLockMock.mockResolvedValueOnce(1);
		findTaskByIdOrThrowMock.mockResolvedValueOnce(updated);

		const actual = await updateTaskUseCase('project-1', 'task-1', {
			title: '更新後タスク',
			updatedAt: '2026-02-20T00:00:00.000Z'
		});

		expect(updateTaskWithoutLockMock).toHaveBeenCalledTimes(1);
		expect(actual).toEqual(updated);
	});

	it('updateTaskUseCase should throw optimistic lock error when timestamp mismatches', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(
			createTaskFixture({ updatedAt: new Date('2026-02-21T00:00:00.000Z') })
		);

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				title: '更新後タスク',
				updatedAt: '2026-02-20T00:00:00.000Z'
			})
		).rejects.toBeInstanceOf(TaskOptimisticLockError);
		expect(updateTaskWhereUpdatedAtMock).not.toHaveBeenCalled();
	});

	it('updateTaskUseCase should advance updatedAt on relation-only updates', async () => {
		const existing = createTaskFixture();
		const updated = createTaskFixture({
			assignees: [{ userId: 'user-2' }],
			updatedAt: new Date('2026-02-21T00:00:00.000Z')
		});
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(existing);
		countUsersByIdsMock.mockResolvedValueOnce(1);
		updateTaskWhereUpdatedAtMock.mockResolvedValueOnce(1);
		findTaskByIdOrThrowMock.mockResolvedValueOnce(updated);

		const actual = await updateTaskUseCase('project-1', 'task-1', {
			assigneeIds: ['user-2'],
			updatedAt: '2026-02-20T00:00:00.000Z'
		});

		expect(updateTaskWhereUpdatedAtMock).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: 'project-1',
				taskId: 'task-1',
				expectedUpdatedAt: new Date('2026-02-20T00:00:00.000Z'),
				data: {
					updatedAt: expect.any(Date)
				}
			}),
			txMock
		);
		expect(replaceTaskAssigneesMock).toHaveBeenCalledWith('task-1', ['user-2'], txMock);
		expect(createTaskHistoryRecordMock).toHaveBeenCalledWith(
			expect.objectContaining({
				taskId: 'task-1',
				projectId: 'project-1',
				action: 'updated',
				changedFields: ['assigneeIds'],
				assigneeIds: ['user-2']
			}),
			txMock
		);
		expect(actual).toEqual(updated);
	});

	it('deleteTaskUseCase should return false when task does not exist', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(null);
		deleteTaskByIdInProjectMock.mockResolvedValueOnce(0);

		await expect(deleteTaskUseCase('project-1', 'task-missing')).resolves.toBe(false);
	});

	it('deleteTaskUseCase should delete task when it exists', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockReset();
		findTaskByIdInProjectMock.mockResolvedValue(createTaskFixture());
		deleteTaskByIdInProjectMock.mockReset();
		deleteTaskByIdInProjectMock.mockResolvedValue(1);

		await expect(deleteTaskUseCase('project-1', 'task-1')).resolves.toBe(true);
		expect(deleteTaskByIdInProjectMock).toHaveBeenCalledWith('project-1', 'task-1', txMock);
		expect(createTaskHistoryRecordMock).toHaveBeenCalledWith(
			expect.objectContaining({
				taskId: 'task-1',
				projectId: 'project-1',
				action: 'deleted'
			}),
			txMock
		);
	});

	it('listTaskHistoryUseCase should return history rows in project scope', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		listTaskHistoryByTaskIdInProjectMock.mockResolvedValueOnce([
			{
				id: 'history-1',
				taskId: 'task-1',
				projectId: 'project-1',
				action: 'updated',
				changedFields: ['title'],
				title: '更新後',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 40,
				assigneeIds: ['user-1'],
				predecessorTaskId: null,
				createdAt: new Date('2026-02-21T00:00:00.000Z')
			}
		]);

		await expect(listTaskHistoryUseCase('project-1', 'task-1')).resolves.toEqual([
			expect.objectContaining({
				id: 'history-1',
				taskId: 'task-1',
				action: 'updated'
			})
		]);
		expect(listTaskHistoryByTaskIdInProjectMock).toHaveBeenCalledWith('project-1', 'task-1');
	});

	it('reorderTasksUseCase should reject when ids count does not match', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		listTaskIdsByProjectIdMock.mockResolvedValueOnce(['task-1', 'task-2']);

		await expect(reorderTasksUseCase('project-1', ['task-1'])).rejects.toBeInstanceOf(
			TaskModelValidationError
		);
		expect(updateTaskSortOrderMock).not.toHaveBeenCalled();
	});

	it('reorderTasksUseCase should update sort orders and return tasks', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		listTaskIdsByProjectIdMock.mockResolvedValueOnce(['task-1', 'task-2']);
		listTasksByProjectIdMock.mockResolvedValueOnce([
			createTaskFixture({ id: 'task-2', sortOrder: 0 }),
			createTaskFixture({ id: 'task-1', sortOrder: 1 })
		]);

		const actual = await reorderTasksUseCase('project-1', ['task-2', 'task-1']);

		expect(updateTaskSortOrderMock).toHaveBeenNthCalledWith(1, 'task-2', 0, txMock);
		expect(updateTaskSortOrderMock).toHaveBeenNthCalledWith(2, 'task-1', 1, txMock);
		expect(actual).toEqual([
			createTaskFixture({ id: 'task-2', sortOrder: 0 }),
			createTaskFixture({ id: 'task-1', sortOrder: 1 })
		]);
	});
});
