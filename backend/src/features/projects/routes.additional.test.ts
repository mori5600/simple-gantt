import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	createProjectUseCaseMock,
	deleteProjectUseCaseMock,
	listProjectMembersUseCaseMock,
	listProjectsUseCaseMock,
	listProjectSummariesUseCaseMock,
	ProjectModelValidationErrorMock,
	ProjectOptimisticLockErrorMock,
	reorderProjectsUseCaseMock,
	setProjectMembersUseCaseMock,
	updateProjectUseCaseMock
} = vi.hoisted(() => {
	class ProjectModelValidationErrorMock extends Error {}
	class ProjectOptimisticLockErrorMock extends Error {}

	return {
		createProjectUseCaseMock: vi.fn(),
		deleteProjectUseCaseMock: vi.fn(),
		listProjectMembersUseCaseMock: vi.fn(),
		listProjectsUseCaseMock: vi.fn(),
		listProjectSummariesUseCaseMock: vi.fn(),
		ProjectModelValidationErrorMock,
		ProjectOptimisticLockErrorMock,
		reorderProjectsUseCaseMock: vi.fn(),
		setProjectMembersUseCaseMock: vi.fn(),
		updateProjectUseCaseMock: vi.fn()
	};
});

vi.mock('./usecases', () => ({
	createProjectUseCase: createProjectUseCaseMock,
	deleteProjectUseCase: deleteProjectUseCaseMock,
	listProjectMembersUseCase: listProjectMembersUseCaseMock,
	listProjectsUseCase: listProjectsUseCaseMock,
	listProjectSummariesUseCase: listProjectSummariesUseCaseMock,
	ProjectModelValidationError: ProjectModelValidationErrorMock,
	ProjectOptimisticLockError: ProjectOptimisticLockErrorMock,
	reorderProjectsUseCase: reorderProjectsUseCaseMock,
	setProjectMembersUseCase: setProjectMembersUseCaseMock,
	updateProjectUseCase: updateProjectUseCaseMock
}));

import { createApp } from '../../app';

describe('project routes additional cases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('PATCH /api/projects/:id should return 404 when project does not exist', async () => {
		updateProjectUseCaseMock.mockResolvedValueOnce(null);

		const response = await createApp().request('/api/projects/project-missing', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: '更新',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'project not found' });
	});

	it('PATCH /api/projects/:id should return the updated project', async () => {
		updateProjectUseCaseMock.mockResolvedValueOnce({
			id: 'project-1',
			name: '更新後',
			sortOrder: 0,
			updatedAt: new Date('2026-03-02T00:00:00.000Z')
		});

		const response = await createApp().request('/api/projects/project-1', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			id: 'project-1',
			name: '更新後',
			sortOrder: 0,
			updatedAt: '2026-03-02T00:00:00.000Z'
		});
	});

	it('PATCH /api/projects/:id should return 409 for optimistic lock errors', async () => {
		updateProjectUseCaseMock.mockRejectedValueOnce(
			new ProjectOptimisticLockErrorMock('project は他ユーザーによって更新されました。')
		);

		const response = await createApp().request('/api/projects/project-1', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		});

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toEqual({
			error: 'project は他ユーザーによって更新されました。'
		});
	});

	it('GET /api/projects should return 400 when listing fails with a validation error', async () => {
		listProjectsUseCaseMock.mockRejectedValueOnce(
			new ProjectModelValidationErrorMock('project list validation failed')
		);

		const response = await createApp().request('/api/projects');

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'project list validation failed'
		});
	});

	it('GET /api/projects/summary should return 400 when listing fails with a validation error', async () => {
		listProjectSummariesUseCaseMock.mockRejectedValueOnce(
			new ProjectModelValidationErrorMock('project summary validation failed')
		);

		const response = await createApp().request('/api/projects/summary');

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'project summary validation failed'
		});
	});

	it('POST /api/projects should return 400 when creation fails with a validation error', async () => {
		createProjectUseCaseMock.mockRejectedValueOnce(
			new ProjectModelValidationErrorMock('project creation validation failed')
		);

		const response = await createApp().request('/api/projects', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: '新規'
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'project creation validation failed'
		});
	});

	it('DELETE /api/projects/:id should delete a project', async () => {
		deleteProjectUseCaseMock.mockResolvedValueOnce(true);

		const response = await createApp().request('/api/projects/project-1', {
			method: 'DELETE'
		});

		expect(response.status).toBe(204);
		expect(deleteProjectUseCaseMock).toHaveBeenCalledWith('project-1');
	});

	it('DELETE /api/projects/:id should return 404 when project does not exist', async () => {
		deleteProjectUseCaseMock.mockResolvedValueOnce(false);

		const response = await createApp().request('/api/projects/project-missing', {
			method: 'DELETE'
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'project not found' });
	});

	it('POST /api/projects/reorder should return reordered projects', async () => {
		reorderProjectsUseCaseMock.mockResolvedValueOnce([
			{
				id: 'project-2',
				name: '後',
				sortOrder: 0,
				updatedAt: new Date('2026-03-02T00:00:00.000Z')
			},
			{
				id: 'project-1',
				name: '先',
				sortOrder: 1,
				updatedAt: new Date('2026-03-02T00:00:00.000Z')
			}
		]);

		const response = await createApp().request('/api/projects/reorder', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				ids: ['project-2', 'project-1']
			})
		});

		expect(response.status).toBe(200);
		expect(reorderProjectsUseCaseMock).toHaveBeenCalledWith(['project-2', 'project-1']);
		await expect(response.json()).resolves.toEqual([
			{
				id: 'project-2',
				name: '後',
				sortOrder: 0,
				updatedAt: '2026-03-02T00:00:00.000Z'
			},
			{
				id: 'project-1',
				name: '先',
				sortOrder: 1,
				updatedAt: '2026-03-02T00:00:00.000Z'
			}
		]);
	});

	it('POST /api/projects/reorder should return 400 for validation errors', async () => {
		reorderProjectsUseCaseMock.mockRejectedValueOnce(
			new ProjectModelValidationErrorMock('ids の並び順が不正です。')
		);

		const response = await createApp().request('/api/projects/reorder', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				ids: ['project-1']
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'ids の並び順が不正です。'
		});
	});

	it('PUT /api/projects/:id/members should return 404 when project does not exist', async () => {
		setProjectMembersUseCaseMock.mockResolvedValueOnce(null);

		const response = await createApp().request('/api/projects/project-missing/members', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				userIds: ['user-1']
			})
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'project not found' });
	});

	it('PUT /api/projects/:id/members should return 400 for validation errors', async () => {
		setProjectMembersUseCaseMock.mockRejectedValueOnce(
			new ProjectModelValidationErrorMock('担当タスクが存在するメンバーは外せません。')
		);

		const response = await createApp().request('/api/projects/project-1/members', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				userIds: ['user-1']
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: '担当タスクが存在するメンバーは外せません。'
		});
	});
});
