import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	createTaskUseCaseMock,
	deleteTaskUseCaseMock,
	listTaskHistoryUseCaseMock,
	listTasksUseCaseMock,
	ProjectNotFoundErrorMock,
	reorderTasksUseCaseMock,
	TaskModelValidationErrorMock,
	TaskOptimisticLockErrorMock,
	updateTaskUseCaseMock
} = vi.hoisted(() => {
	class ProjectNotFoundErrorMock extends Error {}
	class TaskModelValidationErrorMock extends Error {}
	class TaskOptimisticLockErrorMock extends Error {}

	return {
		createTaskUseCaseMock: vi.fn(),
		deleteTaskUseCaseMock: vi.fn(),
		listTaskHistoryUseCaseMock: vi.fn(),
		listTasksUseCaseMock: vi.fn(),
		ProjectNotFoundErrorMock,
		reorderTasksUseCaseMock: vi.fn(),
		TaskModelValidationErrorMock,
		TaskOptimisticLockErrorMock,
		updateTaskUseCaseMock: vi.fn()
	};
});

vi.mock('./usecases', () => ({
	createTaskUseCase: createTaskUseCaseMock,
	deleteTaskUseCase: deleteTaskUseCaseMock,
	listTaskHistoryUseCase: listTaskHistoryUseCaseMock,
	listTasksUseCase: listTasksUseCaseMock,
	ProjectNotFoundError: ProjectNotFoundErrorMock,
	reorderTasksUseCase: reorderTasksUseCaseMock,
	TaskModelValidationError: TaskModelValidationErrorMock,
	TaskOptimisticLockError: TaskOptimisticLockErrorMock,
	updateTaskUseCase: updateTaskUseCaseMock
}));

import { createApp } from '../../app';

describe('task routes additional cases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET /api/tasks should return 404 when project does not exist', async () => {
		listTasksUseCaseMock.mockRejectedValueOnce(
			new ProjectNotFoundErrorMock('project not found: project-missing')
		);

		const response = await createApp().request('/api/tasks?projectId=project-missing');

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: 'project not found: project-missing'
		});
	});

	it('GET /api/tasks/:id/history should return 404 when project does not exist', async () => {
		listTaskHistoryUseCaseMock.mockRejectedValueOnce(
			new ProjectNotFoundErrorMock('project not found: project-missing')
		);

		const response = await createApp().request(
			'/api/tasks/task-1/history?projectId=project-missing'
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: 'project not found: project-missing'
		});
	});

	it('POST /api/tasks should return 404 when project does not exist', async () => {
		createTaskUseCaseMock.mockRejectedValueOnce(
			new ProjectNotFoundErrorMock('project not found: project-missing')
		);

		const response = await createApp().request('/api/tasks?projectId=project-missing', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: '実装',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-02',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: null
			})
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: 'project not found: project-missing'
		});
	});

	it('PATCH /api/tasks/:id should return 404 when task does not exist', async () => {
		updateTaskUseCaseMock.mockResolvedValueOnce(null);

		const response = await createApp().request('/api/tasks/task-missing?projectId=project-1', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: '更新',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'task not found' });
	});

	it('PATCH /api/tasks/:id should return 400 for validation errors', async () => {
		updateTaskUseCaseMock.mockRejectedValueOnce(
			new TaskModelValidationErrorMock('startDate は endDate 以下にしてください。')
		);

		const response = await createApp().request('/api/tasks/task-1?projectId=project-1', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: '更新',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'startDate は endDate 以下にしてください。'
		});
	});

	it('PATCH /api/tasks/:id should return the updated task', async () => {
		updateTaskUseCaseMock.mockResolvedValueOnce({
			id: 'task-1',
			projectId: 'project-1',
			title: '更新後',
			note: '',
			startDate: '2026-03-01',
			endDate: '2026-03-02',
			progress: 20,
			sortOrder: 0,
			predecessorTaskId: null,
			updatedAt: new Date('2026-03-02T00:00:00.000Z'),
			assignees: [{ userId: 'user-1' }]
		});

		const response = await createApp().request('/api/tasks/task-1?projectId=project-1', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			id: 'task-1',
			projectId: 'project-1',
			title: '更新後',
			note: '',
			startDate: '2026-03-01',
			endDate: '2026-03-02',
			progress: 20,
			sortOrder: 0,
			predecessorTaskId: null,
			updatedAt: '2026-03-02T00:00:00.000Z',
			assigneeIds: ['user-1']
		});
	});

	it('DELETE /api/tasks/:id should delete a task', async () => {
		deleteTaskUseCaseMock.mockResolvedValueOnce(true);

		const response = await createApp().request('/api/tasks/task-1?projectId=project-1', {
			method: 'DELETE'
		});

		expect(response.status).toBe(204);
		expect(deleteTaskUseCaseMock).toHaveBeenCalledWith('project-1', 'task-1');
	});

	it('DELETE /api/tasks/:id should return 404 when task does not exist', async () => {
		deleteTaskUseCaseMock.mockResolvedValueOnce(false);

		const response = await createApp().request('/api/tasks/task-missing?projectId=project-1', {
			method: 'DELETE'
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'task not found' });
	});

	it('POST /api/tasks/reorder should return reordered tasks', async () => {
		reorderTasksUseCaseMock.mockResolvedValueOnce([
			{
				id: 'task-2',
				projectId: 'project-1',
				title: '後続',
				note: '',
				startDate: '2026-03-02',
				endDate: '2026-03-03',
				progress: 0,
				sortOrder: 0,
				predecessorTaskId: null,
				updatedAt: new Date('2026-03-02T00:00:00.000Z'),
				assignees: [{ userId: 'user-2' }]
			}
		]);

		const response = await createApp().request('/api/tasks/reorder?projectId=project-1', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				ids: ['task-2']
			})
		});

		expect(response.status).toBe(200);
		expect(reorderTasksUseCaseMock).toHaveBeenCalledWith('project-1', ['task-2']);
		await expect(response.json()).resolves.toEqual([
			{
				id: 'task-2',
				projectId: 'project-1',
				title: '後続',
				note: '',
				startDate: '2026-03-02',
				endDate: '2026-03-03',
				progress: 0,
				sortOrder: 0,
				predecessorTaskId: null,
				updatedAt: '2026-03-02T00:00:00.000Z',
				assigneeIds: ['user-2']
			}
		]);
	});

	it('POST /api/tasks/reorder should return 400 for validation errors', async () => {
		reorderTasksUseCaseMock.mockRejectedValueOnce(
			new TaskModelValidationErrorMock('ids の件数が task 件数と一致しません。')
		);

		const response = await createApp().request('/api/tasks/reorder?projectId=project-1', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				ids: ['task-1']
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'ids の件数が task 件数と一致しません。'
		});
	});
});
