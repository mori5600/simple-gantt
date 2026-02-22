import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
	prismaMock: {
		project: {
			findUnique: vi.fn()
		},
		user: {
			count: vi.fn()
		},
		task: {
			aggregate: vi.fn(),
			create: vi.fn(),
			deleteMany: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			findUniqueOrThrow: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn()
		},
		taskAssignee: {
			deleteMany: vi.fn(),
			createMany: vi.fn()
		}
	}
}));

vi.mock('./db', () => ({
	prisma: prismaMock
}));

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
	updateTaskSortOrder,
	updateTaskWhereUpdatedAt,
	updateTaskWithoutLock
} from './task-model';

describe('task-model', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('findProjectById should return selected record', async () => {
		prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'project-1' });

		const actual = await findProjectById('project-1');

		expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
			where: {
				id: 'project-1'
			},
			select: {
				id: true
			}
		});
		expect(actual).toEqual({ id: 'project-1' });
	});

	it('listTasksByProjectId should request sorted tasks with assignees', async () => {
		const rows = [
			{
				id: 'task-1',
				projectId: 'project-1',
				title: '設計',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 0,
				sortOrder: 0,
				predecessorTaskId: null,
				updatedAt: new Date('2026-02-20T00:00:00.000Z'),
				assignees: [{ userId: 'user-1' }]
			}
		];
		prismaMock.task.findMany.mockResolvedValueOnce(rows);

		const actual = await listTasksByProjectId('project-1');

		expect(prismaMock.task.findMany).toHaveBeenCalledWith({
			where: {
				projectId: 'project-1'
			},
			include: {
				assignees: {
					select: {
						userId: true
					}
				}
			},
			orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }, { id: 'asc' }]
		});
		expect(actual).toEqual(rows);
	});

	it('createTaskRecord should persist and map created task', async () => {
		prismaMock.task.create.mockResolvedValueOnce({
			id: 'task-1',
			projectId: 'project-1',
			title: '設計',
			note: 'note',
			startDate: '2026-02-20',
			endDate: '2026-02-21',
			progress: 10,
			sortOrder: 2,
			predecessorTaskId: null,
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});

		const actual = await createTaskRecord({
			id: 'task-1',
			projectId: 'project-1',
			title: '設計',
			note: 'note',
			startDate: '2026-02-20',
			endDate: '2026-02-21',
			progress: 10,
			sortOrder: 2,
			predecessorTaskId: null
		});

		expect(prismaMock.task.create).toHaveBeenCalledWith({
			data: {
				id: 'task-1',
				projectId: 'project-1',
				title: '設計',
				note: 'note',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 10,
				sortOrder: 2,
				predecessorTaskId: null
			}
		});
		expect(actual).toEqual({
			id: 'task-1',
			projectId: 'project-1',
			title: '設計',
			note: 'note',
			startDate: '2026-02-20',
			endDate: '2026-02-21',
			progress: 10,
			sortOrder: 2,
			predecessorTaskId: null,
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});
	});

	it('createTaskAssignees should create only when ids are provided', async () => {
		await createTaskAssignees('task-1', []);
		expect(prismaMock.taskAssignee.createMany).not.toHaveBeenCalled();

		await createTaskAssignees('task-1', ['user-1', 'user-2']);
		expect(prismaMock.taskAssignee.createMany).toHaveBeenCalledWith({
			data: [
				{ taskId: 'task-1', userId: 'user-1' },
				{ taskId: 'task-1', userId: 'user-2' }
			]
		});
	});

	it('findTaskByIdInProject should fetch task with assignees', async () => {
		prismaMock.task.findFirst.mockResolvedValueOnce({ id: 'task-1' });

		await findTaskByIdInProject('project-1', 'task-1');

		expect(prismaMock.task.findFirst).toHaveBeenCalledWith({
			where: {
				id: 'task-1',
				projectId: 'project-1'
			},
			include: {
				assignees: {
					select: {
						userId: true
					}
				}
			}
		});
	});

	it('findTaskByIdOrThrow should fetch task by id', async () => {
		prismaMock.task.findUniqueOrThrow.mockResolvedValueOnce({ id: 'task-1' });

		await findTaskByIdOrThrow('task-1');

		expect(prismaMock.task.findUniqueOrThrow).toHaveBeenCalledWith({
			where: {
				id: 'task-1'
			},
			include: {
				assignees: {
					select: {
						userId: true
					}
				}
			}
		});
	});

	it('findTaskPredecessorInProject should return predecessor fields only', async () => {
		prismaMock.task.findFirst.mockResolvedValueOnce({ id: 'task-2', predecessorTaskId: 'task-1' });

		await findTaskPredecessorInProject('project-1', 'task-2');

		expect(prismaMock.task.findFirst).toHaveBeenCalledWith({
			where: {
				id: 'task-2',
				projectId: 'project-1'
			},
			select: {
				id: true,
				predecessorTaskId: true
			}
		});
	});

	it('countUsersByIds should return count and skip empty list', async () => {
		prismaMock.user.count.mockResolvedValueOnce(2);

		await expect(countUsersByIds(['user-1', 'user-2'])).resolves.toBe(2);
		expect(prismaMock.user.count).toHaveBeenCalledWith({
			where: {
				id: {
					in: ['user-1', 'user-2']
				}
			}
		});

		await expect(countUsersByIds([])).resolves.toBe(0);
	});

	it('nextTaskSortOrder should return max sortOrder plus one', async () => {
		prismaMock.task.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 5 } });

		const actual = await nextTaskSortOrder('project-1');

		expect(prismaMock.task.aggregate).toHaveBeenCalledWith({
			where: {
				projectId: 'project-1'
			},
			_max: {
				sortOrder: true
			}
		});
		expect(actual).toBe(6);
	});

	it('updateTaskWhereUpdatedAt should update with optimistic lock', async () => {
		prismaMock.task.updateMany.mockResolvedValueOnce({ count: 1 });

		const actual = await updateTaskWhereUpdatedAt({
			projectId: 'project-1',
			taskId: 'task-1',
			expectedUpdatedAt: new Date('2026-02-20T00:00:00.000Z'),
			data: { title: '更新' }
		});

		expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
			where: {
				id: 'task-1',
				projectId: 'project-1',
				updatedAt: new Date('2026-02-20T00:00:00.000Z')
			},
			data: {
				title: '更新'
			}
		});
		expect(actual).toBe(1);
	});

	it('updateTaskWithoutLock should update without updatedAt condition', async () => {
		prismaMock.task.updateMany.mockResolvedValueOnce({ count: 1 });

		const actual = await updateTaskWithoutLock({
			projectId: 'project-1',
			taskId: 'task-1',
			data: { title: '更新' }
		});

		expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
			where: {
				id: 'task-1',
				projectId: 'project-1'
			},
			data: {
				title: '更新'
			}
		});
		expect(actual).toBe(1);
	});

	it('findTaskUpdatedAt should return timestamp or null', async () => {
		prismaMock.task.findFirst
			.mockResolvedValueOnce({ updatedAt: new Date('2026-02-20T00:00:00.000Z') })
			.mockResolvedValueOnce(null);

		await expect(findTaskUpdatedAt('project-1', 'task-1')).resolves.toEqual(
			new Date('2026-02-20T00:00:00.000Z')
		);
		await expect(findTaskUpdatedAt('project-1', 'task-2')).resolves.toBeNull();
	});

	it('replaceTaskAssignees should replace assignment set', async () => {
		await replaceTaskAssignees('task-1', ['user-2']);

		expect(prismaMock.taskAssignee.deleteMany).toHaveBeenCalledWith({
			where: {
				taskId: 'task-1'
			}
		});
		expect(prismaMock.taskAssignee.createMany).toHaveBeenCalledWith({
			data: [{ taskId: 'task-1', userId: 'user-2' }]
		});
	});

	it('deleteTaskByIdInProject should return deleted count', async () => {
		prismaMock.task.deleteMany.mockResolvedValueOnce({ count: 1 });

		const actual = await deleteTaskByIdInProject('project-1', 'task-1');

		expect(prismaMock.task.deleteMany).toHaveBeenCalledWith({
			where: {
				id: 'task-1',
				projectId: 'project-1'
			}
		});
		expect(actual).toBe(1);
	});

	it('listTaskIdsByProjectId should map task ids', async () => {
		prismaMock.task.findMany.mockResolvedValueOnce([{ id: 'task-1' }, { id: 'task-2' }]);

		const actual = await listTaskIdsByProjectId('project-1');

		expect(prismaMock.task.findMany).toHaveBeenCalledWith({
			where: {
				projectId: 'project-1'
			},
			select: {
				id: true
			}
		});
		expect(actual).toEqual(['task-1', 'task-2']);
	});

	it('updateTaskSortOrder should update task sort order', async () => {
		prismaMock.task.update.mockResolvedValueOnce({ id: 'task-1' });

		await updateTaskSortOrder('task-1', 3);

		expect(prismaMock.task.update).toHaveBeenCalledWith({
			where: {
				id: 'task-1'
			},
			data: {
				sortOrder: 3
			}
		});
	});
});
