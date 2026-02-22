import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	txMock,
	prismaMock,
	nextProjectSortOrderMock,
	listProjectsMock,
	listProjectsWithTaskCountMock,
	createProjectRecordMock,
	findProjectByIdMock,
	updateProjectWhereUpdatedAtMock,
	updateProjectByIdMock,
	findProjectUpdatedAtByIdMock,
	findProjectTaskCountByIdMock,
	deleteProjectByIdMock,
	listProjectIdsMock,
	updateProjectSortOrderMock
} = vi.hoisted(() => {
	const txMock = { tx: true };
	return {
		txMock,
		prismaMock: {
			$transaction: vi.fn()
		},
		nextProjectSortOrderMock: vi.fn(),
		listProjectsMock: vi.fn(),
		listProjectsWithTaskCountMock: vi.fn(),
		createProjectRecordMock: vi.fn(),
		findProjectByIdMock: vi.fn(),
		updateProjectWhereUpdatedAtMock: vi.fn(),
		updateProjectByIdMock: vi.fn(),
		findProjectUpdatedAtByIdMock: vi.fn(),
		findProjectTaskCountByIdMock: vi.fn(),
		deleteProjectByIdMock: vi.fn(),
		listProjectIdsMock: vi.fn(),
		updateProjectSortOrderMock: vi.fn()
	};
});

vi.mock('../models/db', () => ({
	prisma: prismaMock
}));

vi.mock('../models/project-model', () => ({
	nextProjectSortOrder: nextProjectSortOrderMock,
	listProjects: listProjectsMock,
	listProjectsWithTaskCount: listProjectsWithTaskCountMock,
	createProjectRecord: createProjectRecordMock,
	findProjectById: findProjectByIdMock,
	updateProjectWhereUpdatedAt: updateProjectWhereUpdatedAtMock,
	updateProjectById: updateProjectByIdMock,
	findProjectUpdatedAtById: findProjectUpdatedAtByIdMock,
	findProjectTaskCountById: findProjectTaskCountByIdMock,
	deleteProjectById: deleteProjectByIdMock,
	listProjectIds: listProjectIdsMock,
	updateProjectSortOrder: updateProjectSortOrderMock
}));

import {
	createProjectUseCase,
	deleteProjectUseCase,
	listProjectSummariesUseCase,
	listProjectsUseCase,
	ProjectModelValidationError,
	ProjectOptimisticLockError,
	reorderProjectsUseCase,
	updateProjectUseCase
} from './project-usecases';

describe('project-usecases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
			callback(txMock)
		);
	});

	it('listProjectsUseCase should return projects', async () => {
		const rows = [
			{ id: 'project-1', name: 'A', sortOrder: 0, updatedAt: new Date('2026-02-19T00:00:00.000Z') }
		];
		listProjectsMock.mockResolvedValueOnce(rows);

		await expect(listProjectsUseCase()).resolves.toEqual(rows);
		expect(listProjectsMock).toHaveBeenCalledTimes(1);
	});

	it('listProjectSummariesUseCase should return project summaries', async () => {
		const rows = [
			{
				id: 'project-1',
				name: 'A',
				sortOrder: 0,
				updatedAt: new Date('2026-02-19T00:00:00.000Z'),
				taskCount: 2
			}
		];
		listProjectsWithTaskCountMock.mockResolvedValueOnce(rows);

		await expect(listProjectSummariesUseCase()).resolves.toEqual(rows);
		expect(listProjectsWithTaskCountMock).toHaveBeenCalledTimes(1);
	});

	it('createProjectUseCase should create project with generated id and next sortOrder', async () => {
		const randomUUIDMock = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('uuid-1');
		nextProjectSortOrderMock.mockResolvedValueOnce(3);
		createProjectRecordMock.mockResolvedValueOnce({
			id: 'project-uuid-1',
			name: '運用改善',
			sortOrder: 3,
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});

		const actual = await createProjectUseCase({ name: '運用改善' });

		expect(createProjectRecordMock).toHaveBeenCalledWith({
			id: 'project-uuid-1',
			name: '運用改善',
			sortOrder: 3
		});
		expect(actual).toEqual({
			id: 'project-uuid-1',
			name: '運用改善',
			sortOrder: 3,
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});
		randomUUIDMock.mockRestore();
	});

	it('updateProjectUseCase should return null when project does not exist', async () => {
		findProjectByIdMock.mockResolvedValueOnce(null);

		await expect(
			updateProjectUseCase('project-missing', {
				name: '更新',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		).resolves.toBeNull();
		expect(updateProjectWhereUpdatedAtMock).not.toHaveBeenCalled();
	});

	it('updateProjectUseCase should return existing project for no-op update', async () => {
		const existing = {
			id: 'project-1',
			name: '運用改善',
			sortOrder: 1,
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		};
		findProjectByIdMock.mockResolvedValueOnce(existing);

		await expect(
			updateProjectUseCase('project-1', {
				name: '運用改善',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		).resolves.toEqual(existing);
		expect(updateProjectWhereUpdatedAtMock).not.toHaveBeenCalled();
		expect(updateProjectByIdMock).not.toHaveBeenCalled();
	});

	it('updateProjectUseCase should throw optimistic lock error on timestamp mismatch', async () => {
		findProjectByIdMock.mockResolvedValueOnce({
			id: 'project-1',
			name: '運用改善',
			sortOrder: 1,
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});

		await expect(
			updateProjectUseCase('project-1', {
				name: '更新',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		).rejects.toBeInstanceOf(ProjectOptimisticLockError);
	});

	it('updateProjectUseCase should throw optimistic lock error on concurrent update', async () => {
		findProjectByIdMock.mockResolvedValueOnce({
			id: 'project-1',
			name: '運用改善',
			sortOrder: 1,
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});
		updateProjectWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findProjectUpdatedAtByIdMock.mockResolvedValueOnce(new Date('2026-02-20T00:00:00.000Z'));

		await expect(
			updateProjectUseCase('project-1', {
				name: '更新',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		).rejects.toBeInstanceOf(ProjectOptimisticLockError);
		expect(updateProjectByIdMock).not.toHaveBeenCalled();
	});

	it('updateProjectUseCase should fallback-update when updatedAt is unchanged', async () => {
		findProjectByIdMock.mockResolvedValueOnce({
			id: 'project-1',
			name: '運用改善',
			sortOrder: 1,
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});
		updateProjectWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findProjectUpdatedAtByIdMock.mockResolvedValueOnce(new Date('2026-02-19T00:00:00.000Z'));
		updateProjectByIdMock.mockResolvedValueOnce({
			id: 'project-1',
			name: '更新',
			sortOrder: 1,
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});

		const actual = await updateProjectUseCase('project-1', {
			name: '更新',
			updatedAt: '2026-02-19T00:00:00.000Z'
		});

		expect(updateProjectByIdMock).toHaveBeenCalledWith('project-1', '更新');
		expect(actual).toEqual({
			id: 'project-1',
			name: '更新',
			sortOrder: 1,
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});
	});

	it('deleteProjectUseCase should return false when project does not exist', async () => {
		findProjectTaskCountByIdMock.mockResolvedValueOnce(null);

		await expect(deleteProjectUseCase('project-missing')).resolves.toBe(false);
		expect(deleteProjectByIdMock).not.toHaveBeenCalled();
	});

	it('deleteProjectUseCase should reject when tasks exist', async () => {
		findProjectTaskCountByIdMock.mockResolvedValueOnce(1);

		await expect(deleteProjectUseCase('project-1')).rejects.toBeInstanceOf(
			ProjectModelValidationError
		);
		expect(deleteProjectByIdMock).not.toHaveBeenCalled();
	});

	it('deleteProjectUseCase should delete project when no tasks exist', async () => {
		findProjectTaskCountByIdMock.mockResolvedValueOnce(0);
		deleteProjectByIdMock.mockResolvedValueOnce(undefined);

		await expect(deleteProjectUseCase('project-1')).resolves.toBe(true);
		expect(deleteProjectByIdMock).toHaveBeenCalledWith('project-1');
	});

	it('reorderProjectsUseCase should reject when ids count does not match', async () => {
		listProjectIdsMock.mockResolvedValueOnce(['project-1', 'project-2']);

		await expect(reorderProjectsUseCase(['project-1'])).rejects.toBeInstanceOf(
			ProjectModelValidationError
		);
		expect(updateProjectSortOrderMock).not.toHaveBeenCalled();
	});

	it('reorderProjectsUseCase should reject when id is missing', async () => {
		listProjectIdsMock.mockResolvedValueOnce(['project-1', 'project-2']);

		await expect(reorderProjectsUseCase(['project-1', 'project-3'])).rejects.toBeInstanceOf(
			ProjectModelValidationError
		);
		expect(updateProjectSortOrderMock).not.toHaveBeenCalled();
	});

	it('reorderProjectsUseCase should update sortOrder in transaction and return list', async () => {
		listProjectIdsMock.mockResolvedValueOnce(['project-1', 'project-2']);
		listProjectsMock.mockResolvedValueOnce([
			{ id: 'project-2', name: 'B', sortOrder: 0, updatedAt: new Date('2026-02-20T00:00:00.000Z') },
			{ id: 'project-1', name: 'A', sortOrder: 1, updatedAt: new Date('2026-02-20T00:00:00.000Z') }
		]);

		const actual = await reorderProjectsUseCase(['project-2', 'project-1']);

		expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
		expect(updateProjectSortOrderMock).toHaveBeenNthCalledWith(1, 'project-2', 0, txMock);
		expect(updateProjectSortOrderMock).toHaveBeenNthCalledWith(2, 'project-1', 1, txMock);
		expect(actual).toEqual([
			{ id: 'project-2', name: 'B', sortOrder: 0, updatedAt: new Date('2026-02-20T00:00:00.000Z') },
			{ id: 'project-1', name: 'A', sortOrder: 1, updatedAt: new Date('2026-02-20T00:00:00.000Z') }
		]);
	});
});
