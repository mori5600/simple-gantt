import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	listTasksUseCaseMock,
	createTaskUseCaseMock,
	updateTaskUseCaseMock,
	deleteTaskUseCaseMock,
	reorderTasksUseCaseMock,
	ProjectNotFoundErrorMock,
	TaskModelValidationErrorMock,
	TaskOptimisticLockErrorMock
} = vi.hoisted(() => {
	class ProjectNotFoundErrorMock extends Error {}
	class TaskModelValidationErrorMock extends Error {}
	class TaskOptimisticLockErrorMock extends Error {}

	return {
		listTasksUseCaseMock: vi.fn(),
		createTaskUseCaseMock: vi.fn(),
		updateTaskUseCaseMock: vi.fn(),
		deleteTaskUseCaseMock: vi.fn(),
		reorderTasksUseCaseMock: vi.fn(),
		ProjectNotFoundErrorMock,
		TaskModelValidationErrorMock,
		TaskOptimisticLockErrorMock
	};
});

vi.mock('../usecases/task-usecases', () => ({
	listTasksUseCase: listTasksUseCaseMock,
	createTaskUseCase: createTaskUseCaseMock,
	updateTaskUseCase: updateTaskUseCaseMock,
	deleteTaskUseCase: deleteTaskUseCaseMock,
	reorderTasksUseCase: reorderTasksUseCaseMock,
	ProjectNotFoundError: ProjectNotFoundErrorMock,
	TaskModelValidationError: TaskModelValidationErrorMock,
	TaskOptimisticLockError: TaskOptimisticLockErrorMock
}));

import { createApp } from '../app';

describe('task routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET /api/tasks should return 400 when projectId is missing', async () => {
		const response = await createApp().request('/api/tasks');
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({
			error: 'projectId クエリは必須です。'
		});
	});

	it('GET /api/tasks should return tasks', async () => {
		listTasksUseCaseMock.mockResolvedValueOnce([
			{
				id: 'task-1',
				projectId: 'project-1',
				title: '設計',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 20,
				sortOrder: 0,
				predecessorTaskId: null,
				updatedAt: new Date('2026-02-20T00:00:00.000Z'),
				assignees: [{ userId: 'user-1' }]
			}
		]);

		const response = await createApp().request('/api/tasks?projectId=project-1');
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual([
			{
				id: 'task-1',
				projectId: 'project-1',
				title: '設計',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 20,
				sortOrder: 0,
				predecessorTaskId: null,
				updatedAt: '2026-02-20T00:00:00.000Z',
				assigneeIds: ['user-1']
			}
		]);
		expect(listTasksUseCaseMock).toHaveBeenCalledWith('project-1');
	});

	it('POST /api/tasks should create task', async () => {
		createTaskUseCaseMock.mockResolvedValueOnce({
			id: 'task-2',
			projectId: 'project-1',
			title: '実装',
			note: 'メモ',
			startDate: '2026-02-21',
			endDate: '2026-02-22',
			progress: 0,
			sortOrder: 1,
			predecessorTaskId: null,
			updatedAt: new Date('2026-02-21T00:00:00.000Z'),
			assignees: [{ userId: 'user-2' }]
		});

		const response = await createApp().request('/api/tasks?projectId=project-1', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: '実装',
				note: 'メモ',
				startDate: '2026-02-21',
				endDate: '2026-02-22',
				progress: 0,
				assigneeIds: ['user-2'],
				predecessorTaskId: null
			})
		});
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({
			id: 'task-2',
			projectId: 'project-1',
			title: '実装',
			note: 'メモ',
			startDate: '2026-02-21',
			endDate: '2026-02-22',
			progress: 0,
			sortOrder: 1,
			predecessorTaskId: null,
			updatedAt: '2026-02-21T00:00:00.000Z',
			assigneeIds: ['user-2']
		});
	});

	it('POST /api/tasks should return 400 for invalid payload', async () => {
		const response = await createApp().request('/api/tasks?projectId=project-1', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: '',
				startDate: '2026-02-21',
				endDate: '2026-02-22',
				progress: 0
			})
		});

		expect(response.status).toBe(400);
	});

	it('PATCH /api/tasks/:id should return 409 on optimistic lock conflict', async () => {
		updateTaskUseCaseMock.mockRejectedValueOnce(
			new TaskOptimisticLockErrorMock(
				'task は他ユーザーによって更新されました。再読み込みして再度お試しください。'
			)
		);

		const response = await createApp().request('/api/tasks/task-1?projectId=project-1', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: '更新',
				updatedAt: '2026-02-20T00:00:00.000Z'
			})
		});
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body).toEqual({
			error: 'task は他ユーザーによって更新されました。再読み込みして再度お試しください。'
		});
	});
});
