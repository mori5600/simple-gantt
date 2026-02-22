import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	listProjectsUseCaseMock,
	listProjectSummariesUseCaseMock,
	createProjectUseCaseMock,
	updateProjectUseCaseMock,
	deleteProjectUseCaseMock,
	reorderProjectsUseCaseMock,
	ProjectModelValidationErrorMock,
	ProjectOptimisticLockErrorMock
} = vi.hoisted(() => {
	class ProjectModelValidationErrorMock extends Error {}
	class ProjectOptimisticLockErrorMock extends Error {}

	return {
		listProjectsUseCaseMock: vi.fn(),
		listProjectSummariesUseCaseMock: vi.fn(),
		createProjectUseCaseMock: vi.fn(),
		updateProjectUseCaseMock: vi.fn(),
		deleteProjectUseCaseMock: vi.fn(),
		reorderProjectsUseCaseMock: vi.fn(),
		ProjectModelValidationErrorMock,
		ProjectOptimisticLockErrorMock
	};
});

vi.mock('../usecases/project-usecases', () => ({
	listProjectsUseCase: listProjectsUseCaseMock,
	listProjectSummariesUseCase: listProjectSummariesUseCaseMock,
	createProjectUseCase: createProjectUseCaseMock,
	updateProjectUseCase: updateProjectUseCaseMock,
	deleteProjectUseCase: deleteProjectUseCaseMock,
	reorderProjectsUseCase: reorderProjectsUseCaseMock,
	ProjectModelValidationError: ProjectModelValidationErrorMock,
	ProjectOptimisticLockError: ProjectOptimisticLockErrorMock
}));

import { createApp } from '../app';

describe('project routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET /api/projects should return projects', async () => {
		listProjectsUseCaseMock.mockResolvedValueOnce([
			{
				id: 'project-1',
				name: '開発基盤',
				sortOrder: 0,
				updatedAt: new Date('2026-02-19T00:00:00.000Z')
			}
		]);

		const response = await createApp().request('/api/projects');
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual([
			{
				id: 'project-1',
				name: '開発基盤',
				sortOrder: 0,
				updatedAt: '2026-02-19T00:00:00.000Z'
			}
		]);
	});

	it('GET /api/projects/summary should return projects with taskCount', async () => {
		listProjectSummariesUseCaseMock.mockResolvedValueOnce([
			{
				id: 'project-1',
				name: '開発基盤',
				sortOrder: 0,
				updatedAt: new Date('2026-02-19T00:00:00.000Z'),
				taskCount: 5
			}
		]);

		const response = await createApp().request('/api/projects/summary');
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual([
			{
				id: 'project-1',
				name: '開発基盤',
				sortOrder: 0,
				updatedAt: '2026-02-19T00:00:00.000Z',
				taskCount: 5
			}
		]);
	});

	it('POST /api/projects should create project', async () => {
		createProjectUseCaseMock.mockResolvedValueOnce({
			id: 'project-2',
			name: '運用改善',
			sortOrder: 1,
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});

		const response = await createApp().request('/api/projects', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ name: '運用改善' })
		});
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(createProjectUseCaseMock).toHaveBeenCalledWith({ name: '運用改善' });
		expect(body).toEqual({
			id: 'project-2',
			name: '運用改善',
			sortOrder: 1,
			updatedAt: '2026-02-20T00:00:00.000Z'
		});
	});
});
