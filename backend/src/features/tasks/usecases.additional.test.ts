import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	countProjectMembersByUserIdsMock,
	createTaskAssigneesMock,
	createTaskHistoryRecordMock,
	createTaskRecordMock,
	deleteTaskByIdInProjectMock,
	findProjectByIdMock,
	findTaskByIdInProjectMock,
	findTaskByIdOrThrowMock,
	findTaskPredecessorInProjectMock,
	findTaskUpdatedAtMock,
	listTaskHistoryByTaskIdInProjectMock,
	listTaskIdsByProjectIdMock,
	listTasksByProjectIdMock,
	nextTaskSortOrderMock,
	prismaMock,
	replaceTaskAssigneesMock,
	updateTaskSortOrderMock,
	updateTaskWhereUpdatedAtMock,
	updateTaskWithoutLockMock
} = vi.hoisted(() => ({
	countProjectMembersByUserIdsMock: vi.fn(),
	createTaskAssigneesMock: vi.fn(),
	createTaskHistoryRecordMock: vi.fn(),
	createTaskRecordMock: vi.fn(),
	deleteTaskByIdInProjectMock: vi.fn(),
	findProjectByIdMock: vi.fn(),
	findTaskByIdInProjectMock: vi.fn(),
	findTaskByIdOrThrowMock: vi.fn(),
	findTaskPredecessorInProjectMock: vi.fn(),
	findTaskUpdatedAtMock: vi.fn(),
	listTaskHistoryByTaskIdInProjectMock: vi.fn(),
	listTaskIdsByProjectIdMock: vi.fn(),
	listTasksByProjectIdMock: vi.fn(),
	nextTaskSortOrderMock: vi.fn(),
	prismaMock: {
		$transaction: vi.fn()
	},
	replaceTaskAssigneesMock: vi.fn(),
	updateTaskSortOrderMock: vi.fn(),
	updateTaskWhereUpdatedAtMock: vi.fn(),
	updateTaskWithoutLockMock: vi.fn()
}));

vi.mock('../../platform/prisma', () => ({
	prisma: prismaMock
}));

vi.mock('./repository', () => ({
	countProjectMembersByUserIds: countProjectMembersByUserIdsMock,
	createTaskAssignees: createTaskAssigneesMock,
	createTaskHistoryRecord: createTaskHistoryRecordMock,
	createTaskRecord: createTaskRecordMock,
	deleteTaskByIdInProject: deleteTaskByIdInProjectMock,
	findProjectById: findProjectByIdMock,
	findTaskByIdInProject: findTaskByIdInProjectMock,
	findTaskByIdOrThrow: findTaskByIdOrThrowMock,
	findTaskPredecessorInProject: findTaskPredecessorInProjectMock,
	findTaskUpdatedAt: findTaskUpdatedAtMock,
	listTaskHistoryByTaskIdInProject: listTaskHistoryByTaskIdInProjectMock,
	listTaskIdsByProjectId: listTaskIdsByProjectIdMock,
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
	ProjectNotFoundError,
	reorderTasksUseCase,
	TaskModelValidationError,
	updateTaskUseCase
} from './usecases';

type MockTask = {
	assignees: Array<{ userId: string }>;
	endDate: string;
	id: string;
	note: string;
	predecessorTaskId: string | null;
	progress: number;
	projectId: string;
	sortOrder: number;
	startDate: string;
	title: string;
	updatedAt: Date;
};

function createTaskFixture(partial: Partial<MockTask> = {}): MockTask {
	return {
		assignees: [{ userId: 'user-1' }],
		endDate: '2026-03-02',
		id: 'task-1',
		note: '',
		predecessorTaskId: null,
		progress: 10,
		projectId: 'project-1',
		sortOrder: 0,
		startDate: '2026-03-01',
		title: '既存タスク',
		updatedAt: new Date('2026-03-01T00:00:00.000Z'),
		...partial
	};
}

describe('tasks usecases additional coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
			callback({ tx: true })
		);
	});

	it('createTaskUseCase should reject when the predecessor task does not exist', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskPredecessorInProjectMock.mockResolvedValueOnce(null);

		await expect(
			createTaskUseCase('project-1', {
				title: '新規',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-02',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: 'task-prev'
			})
		).rejects.toThrow(TaskModelValidationError);
	});

	it('createTaskUseCase should use an explicit sort order when provided', async () => {
		const randomUUIDMock = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('task-2');
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskPredecessorInProjectMock.mockResolvedValueOnce({
			id: 'task-prev',
			predecessorTaskId: null
		});
		createTaskRecordMock.mockResolvedValueOnce({ id: 'task-2' });
		findTaskByIdOrThrowMock.mockResolvedValueOnce(
			createTaskFixture({
				id: 'task-2',
				sortOrder: 9,
				predecessorTaskId: 'task-prev'
			})
		);

		await createTaskUseCase('project-1', {
			title: '新規',
			note: '',
			startDate: '2026-03-01',
			endDate: '2026-03-02',
			progress: 0,
			sortOrder: 9,
			assigneeIds: [],
			predecessorTaskId: 'task-prev'
		});

		expect(nextTaskSortOrderMock).not.toHaveBeenCalled();
		expect(createTaskRecordMock).toHaveBeenCalledWith(
			expect.objectContaining({
				sortOrder: 9,
				predecessorTaskId: 'task-prev'
			}),
			expect.anything()
		);
		randomUUIDMock.mockRestore();
	});

	it('updateTaskUseCase should reject when dates are reversed', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				startDate: '2026-03-03',
				endDate: '2026-03-02',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow(TaskModelValidationError);
	});

	it('updateTaskUseCase should return null when the task does not exist', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(null);

		await expect(
			updateTaskUseCase('project-1', 'task-missing', {
				title: '更新',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toBeNull();
	});

	it('updateTaskUseCase should reject assignees outside the project', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());
		countProjectMembersByUserIdsMock.mockResolvedValueOnce(0);

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				assigneeIds: ['user-outside'],
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow(TaskModelValidationError);
	});

	it('updateTaskUseCase should reject self-referencing predecessors', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				predecessorTaskId: 'task-1',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow(TaskModelValidationError);
	});

	it('updateTaskUseCase should reject missing predecessor tasks', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());
		findTaskPredecessorInProjectMock.mockResolvedValueOnce(null);

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				predecessorTaskId: 'task-missing',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow(TaskModelValidationError);
	});

	it('updateTaskUseCase should reject dependency cycles', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());
		findTaskPredecessorInProjectMock
			.mockResolvedValueOnce({ id: 'task-2', predecessorTaskId: 'task-1' })
			.mockResolvedValueOnce({ id: 'task-2', predecessorTaskId: 'task-1' });

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				predecessorTaskId: 'task-2',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow(TaskModelValidationError);
	});

	it('updateTaskUseCase should throw optimistic lock error when the latest timestamp changed', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());
		updateTaskWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findTaskUpdatedAtMock.mockResolvedValueOnce(new Date('2026-03-02T00:00:00.000Z'));

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				title: '更新',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow('task は他ユーザーによって更新されました。再読み込みして再度お試しください。');
	});

	it('updateTaskUseCase should capture all changed scalar fields in history', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());
		updateTaskWhereUpdatedAtMock.mockResolvedValueOnce(1);
		findTaskByIdOrThrowMock.mockResolvedValueOnce(
			createTaskFixture({
				startDate: '2026-03-05',
				endDate: '2026-03-06',
				progress: 80,
				sortOrder: 4,
				updatedAt: new Date('2026-03-02T00:00:00.000Z')
			})
		);

		await updateTaskUseCase('project-1', 'task-1', {
			startDate: '2026-03-05',
			endDate: '2026-03-06',
			progress: 80,
			sortOrder: 4,
			updatedAt: '2026-03-01T00:00:00.000Z'
		});

		expect(createTaskHistoryRecordMock).toHaveBeenCalledWith(
			expect.objectContaining({
				changedFields: ['startDate', 'endDate', 'progress', 'sortOrder']
			}),
			expect.anything()
		);
	});

	it('updateTaskUseCase should record note changes in history', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());
		updateTaskWhereUpdatedAtMock.mockResolvedValueOnce(1);
		findTaskByIdOrThrowMock.mockResolvedValueOnce(
			createTaskFixture({
				note: '更新メモ',
				updatedAt: new Date('2026-03-02T00:00:00.000Z')
			})
		);

		await updateTaskUseCase('project-1', 'task-1', {
			note: '更新メモ',
			updatedAt: '2026-03-01T00:00:00.000Z'
		});

		expect(createTaskHistoryRecordMock).toHaveBeenCalledWith(
			expect.objectContaining({
				changedFields: ['note']
			}),
			expect.anything()
		);
	});

	it('updateTaskUseCase should treat identical assignee sets as a no-op', async () => {
		const existing = createTaskFixture({
			assignees: [{ userId: 'user-2' }, { userId: 'user-1' }]
		});
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(existing);
		countProjectMembersByUserIdsMock.mockResolvedValueOnce(2);

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				assigneeIds: ['user-1', 'user-2'],
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toEqual(existing);
		expect(updateTaskWhereUpdatedAtMock).not.toHaveBeenCalled();
	});

	it('updateTaskUseCase should replace assignees when the list length changes', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(
			createTaskFixture({
				assignees: [{ userId: 'user-1' }, { userId: 'user-2' }]
			})
		);
		updateTaskWhereUpdatedAtMock.mockResolvedValueOnce(1);
		findTaskByIdOrThrowMock.mockResolvedValueOnce(
			createTaskFixture({
				assignees: [],
				updatedAt: new Date('2026-03-02T00:00:00.000Z')
			})
		);

		await updateTaskUseCase('project-1', 'task-1', {
			assigneeIds: [],
			updatedAt: '2026-03-01T00:00:00.000Z'
		});

		expect(replaceTaskAssigneesMock).toHaveBeenCalledWith('task-1', [], expect.anything());
	});

	it('updateTaskUseCase should return null when the lock target disappears before fallback', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());
		findTaskPredecessorInProjectMock.mockResolvedValueOnce({
			id: 'task-2',
			predecessorTaskId: null
		});
		updateTaskWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findTaskUpdatedAtMock.mockResolvedValueOnce(null);

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				title: '更新',
				predecessorTaskId: 'task-2',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toBeNull();
	});

	it('updateTaskUseCase should return null when fallback update affects no rows', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());
		updateTaskWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findTaskUpdatedAtMock.mockResolvedValueOnce(new Date('2026-03-01T00:00:00.000Z'));
		updateTaskWithoutLockMock.mockResolvedValueOnce(0);

		await expect(
			updateTaskUseCase('project-1', 'task-1', {
				title: '更新',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toBeNull();
	});

	it('deleteTaskUseCase should return false when delete count is zero', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		findTaskByIdInProjectMock.mockResolvedValueOnce(createTaskFixture());
		deleteTaskByIdInProjectMock.mockResolvedValueOnce(0);

		await expect(deleteTaskUseCase('project-1', 'task-1')).resolves.toBe(false);
	});

	it('listTaskHistoryUseCase should reject when project does not exist', async () => {
		findProjectByIdMock.mockResolvedValueOnce(null);

		await expect(listTaskHistoryUseCase('project-missing', 'task-1')).rejects.toThrow(
			ProjectNotFoundError
		);
	});

	it('reorderTasksUseCase should reject when project does not exist', async () => {
		findProjectByIdMock.mockResolvedValueOnce(null);

		await expect(reorderTasksUseCase('project-missing', ['task-1'])).rejects.toThrow(
			ProjectNotFoundError
		);
	});

	it('reorderTasksUseCase should reject unknown task ids', async () => {
		findProjectByIdMock.mockResolvedValueOnce({ id: 'project-1' });
		listTaskIdsByProjectIdMock.mockResolvedValueOnce(['task-1']);

		await expect(reorderTasksUseCase('project-1', ['task-2'])).rejects.toThrow(
			TaskModelValidationError
		);
	});
});
