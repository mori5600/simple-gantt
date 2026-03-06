import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerMock, prismaMock } = vi.hoisted(() => ({
	loggerMock: {
		warn: vi.fn()
	},
	prismaMock: {
		task: {
			aggregate: vi.fn()
		},
		taskAssignee: {
			createMany: vi.fn(),
			deleteMany: vi.fn()
		}
	}
}));

vi.mock('../../platform/logger', () => ({
	logger: loggerMock
}));

vi.mock('../../platform/prisma', () => ({
	prisma: prismaMock
}));

import {
	createTaskHistoryRecord,
	listTaskHistoryByTaskIdInProject,
	nextTaskSortOrder,
	replaceTaskAssignees
} from './repository';

describe('tasks repository additional coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('createTaskHistoryRecord should return null when taskHistory delegate is missing', async () => {
		await expect(
			createTaskHistoryRecord(
				{
					taskId: 'task-1',
					projectId: 'project-1',
					action: 'created',
					changedFields: ['title'],
					title: 'task',
					note: '',
					startDate: '2026-03-01',
					endDate: '2026-03-02',
					progress: 0,
					assigneeIds: ['user-1'],
					predecessorTaskId: null
				},
				{} as never
			)
		).resolves.toBeNull();
	});

	it('createTaskHistoryRecord should serialize arrays and map the created row', async () => {
		const createMock = vi.fn().mockResolvedValue({
			id: 'history-1',
			taskId: 'task-1',
			projectId: 'project-1',
			action: 'created',
			changedFields: '["title"]',
			title: 'task',
			note: '',
			startDate: '2026-03-01',
			endDate: '2026-03-02',
			progress: 0,
			assigneeIds: '["user-1"]',
			predecessorTaskId: null,
			createdAt: new Date('2026-03-01T00:00:00.000Z')
		});

		const db = {
			taskHistory: {
				create: createMock,
				findMany: vi.fn()
			}
		};

		const actual = await createTaskHistoryRecord(
			{
				taskId: 'task-1',
				projectId: 'project-1',
				action: 'created',
				changedFields: ['title'],
				title: 'task',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-02',
				progress: 0,
				assigneeIds: ['user-1'],
				predecessorTaskId: null
			},
			db as never
		);

		expect(createMock).toHaveBeenCalledWith({
			data: expect.objectContaining({
				changedFields: '["title"]',
				assigneeIds: '["user-1"]'
			})
		});
		expect(actual).toEqual({
			id: 'history-1',
			taskId: 'task-1',
			projectId: 'project-1',
			action: 'created',
			changedFields: ['title'],
			title: 'task',
			note: '',
			startDate: '2026-03-01',
			endDate: '2026-03-02',
			progress: 0,
			assigneeIds: ['user-1'],
			predecessorTaskId: null,
			createdAt: new Date('2026-03-01T00:00:00.000Z')
		});
	});

	it('createTaskHistoryRecord should ignore missing table errors', async () => {
		const db = {
			taskHistory: {
				create: vi.fn().mockRejectedValue({ code: 'P2021' }),
				findMany: vi.fn()
			}
		};

		await expect(
			createTaskHistoryRecord(
				{
					taskId: 'task-1',
					projectId: 'project-1',
					action: 'created',
					changedFields: ['title'],
					title: 'task',
					note: '',
					startDate: '2026-03-01',
					endDate: '2026-03-02',
					progress: 0,
					assigneeIds: [],
					predecessorTaskId: null
				},
				db as never
			)
		).resolves.toBeNull();
		expect(loggerMock.warn).toHaveBeenCalledWith(
			{
				err: {
					code: 'P2021'
				}
			},
			'taskHistory table is missing; skip history logging'
		);
	});

	it('createTaskHistoryRecord should rethrow unexpected history errors', async () => {
		const error = new Error('history create failed');
		const db = {
			taskHistory: {
				create: vi.fn().mockRejectedValue(error),
				findMany: vi.fn()
			}
		};

		await expect(
			createTaskHistoryRecord(
				{
					taskId: 'task-1',
					projectId: 'project-1',
					action: 'created',
					changedFields: ['title'],
					title: 'task',
					note: '',
					startDate: '2026-03-01',
					endDate: '2026-03-02',
					progress: 0,
					assigneeIds: [],
					predecessorTaskId: null
				},
				db as never
			)
		).rejects.toThrow(error);
	});

	it('listTaskHistoryByTaskIdInProject should return empty arrays when delegate is missing', async () => {
		await expect(
			listTaskHistoryByTaskIdInProject('project-1', 'task-1', {} as never)
		).resolves.toEqual([]);
	});

	it('listTaskHistoryByTaskIdInProject should ignore invalid delegates without callable methods', async () => {
		await expect(
			listTaskHistoryByTaskIdInProject('project-1', 'task-1', {
				taskHistory: {
					create: 'invalid',
					findMany: vi.fn()
				}
			} as never)
		).resolves.toEqual([]);
	});

	it('listTaskHistoryByTaskIdInProject should map rows and sanitize invalid arrays', async () => {
		const findManyMock = vi.fn().mockResolvedValue([
			{
				id: 'history-1',
				taskId: 'task-1',
				projectId: 'project-1',
				action: 'updated',
				changedFields: '{"bad":true}',
				title: 'task',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-02',
				progress: 0,
				assigneeIds: 'not-json',
				predecessorTaskId: null,
				createdAt: new Date('2026-03-01T00:00:00.000Z')
			}
		]);

		const db = {
			taskHistory: {
				create: vi.fn(),
				findMany: findManyMock
			}
		};

		await expect(
			listTaskHistoryByTaskIdInProject('project-1', 'task-1', db as never)
		).resolves.toEqual([
			{
				id: 'history-1',
				taskId: 'task-1',
				projectId: 'project-1',
				action: 'updated',
				changedFields: [],
				title: 'task',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-02',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: null,
				createdAt: new Date('2026-03-01T00:00:00.000Z')
			}
		]);
		expect(findManyMock).toHaveBeenCalledWith({
			where: {
				projectId: 'project-1',
				taskId: 'task-1'
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
		});
	});

	it('listTaskHistoryByTaskIdInProject should ignore missing table errors', async () => {
		const db = {
			taskHistory: {
				create: vi.fn(),
				findMany: vi.fn().mockRejectedValue({ code: 'P2021' })
			}
		};

		await expect(
			listTaskHistoryByTaskIdInProject('project-1', 'task-1', db as never)
		).resolves.toEqual([]);
		expect(loggerMock.warn).toHaveBeenCalledWith(
			{
				err: {
					code: 'P2021'
				}
			},
			'taskHistory table is missing; return empty history'
		);
	});

	it('listTaskHistoryByTaskIdInProject should rethrow unexpected errors', async () => {
		const error = new Error('history find failed');
		const db = {
			taskHistory: {
				create: vi.fn(),
				findMany: vi.fn().mockRejectedValue(error)
			}
		};

		await expect(
			listTaskHistoryByTaskIdInProject('project-1', 'task-1', db as never)
		).rejects.toThrow(error);
	});

	it('createTaskHistoryRecord should rethrow non-object errors', async () => {
		const db = {
			taskHistory: {
				create: vi.fn().mockRejectedValue('failure'),
				findMany: vi.fn()
			}
		};

		await expect(
			createTaskHistoryRecord(
				{
					taskId: 'task-1',
					projectId: 'project-1',
					action: 'created',
					changedFields: ['title'],
					title: 'task',
					note: '',
					startDate: '2026-03-01',
					endDate: '2026-03-02',
					progress: 0,
					assigneeIds: [],
					predecessorTaskId: null
				},
				db as never
			)
		).rejects.toBe('failure');
	});

	it('replaceTaskAssignees should skip inserts when the next assignee list is empty', async () => {
		await replaceTaskAssignees('task-1', []);

		expect(prismaMock.taskAssignee.deleteMany).toHaveBeenCalledWith({
			where: {
				taskId: 'task-1'
			}
		});
		expect(prismaMock.taskAssignee.createMany).not.toHaveBeenCalled();
	});

	it('nextTaskSortOrder should return zero when there are no tasks', async () => {
		prismaMock.task.aggregate.mockResolvedValueOnce({ _max: { sortOrder: null } });

		await expect(nextTaskSortOrder('project-1')).resolves.toBe(0);
	});
});
