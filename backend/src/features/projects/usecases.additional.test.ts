import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	countTaskAssignmentsForUsersInProjectMock,
	countUsersByIdsMock,
	createProjectRecordMock,
	deleteProjectByIdMock,
	findProjectByIdMock,
	findProjectUpdatedAtByIdMock,
	listProjectIdsMock,
	listProjectMembersMock,
	listProjectMemberUserIdsMock,
	listProjectsMock,
	listProjectsWithTaskCountMock,
	nextProjectSortOrderMock,
	prismaMock,
	replaceProjectMembersMock,
	updateProjectByIdMock,
	updateProjectSortOrderMock,
	updateProjectWhereUpdatedAtMock
} = vi.hoisted(() => ({
	countTaskAssignmentsForUsersInProjectMock: vi.fn(),
	countUsersByIdsMock: vi.fn(),
	createProjectRecordMock: vi.fn(),
	deleteProjectByIdMock: vi.fn(),
	findProjectByIdMock: vi.fn(),
	findProjectUpdatedAtByIdMock: vi.fn(),
	listProjectIdsMock: vi.fn(),
	listProjectMembersMock: vi.fn(),
	listProjectMemberUserIdsMock: vi.fn(),
	listProjectsMock: vi.fn(),
	listProjectsWithTaskCountMock: vi.fn(),
	nextProjectSortOrderMock: vi.fn(),
	prismaMock: {
		$transaction: vi.fn()
	},
	replaceProjectMembersMock: vi.fn(),
	updateProjectByIdMock: vi.fn(),
	updateProjectSortOrderMock: vi.fn(),
	updateProjectWhereUpdatedAtMock: vi.fn()
}));

vi.mock('../../platform/prisma', () => ({
	prisma: prismaMock
}));

vi.mock('./repository', () => ({
	countTaskAssignmentsForUsersInProject: countTaskAssignmentsForUsersInProjectMock,
	countUsersByIds: countUsersByIdsMock,
	createProjectRecord: createProjectRecordMock,
	deleteProjectById: deleteProjectByIdMock,
	findProjectById: findProjectByIdMock,
	findProjectUpdatedAtById: findProjectUpdatedAtByIdMock,
	listProjectIds: listProjectIdsMock,
	listProjectMembers: listProjectMembersMock,
	listProjectMemberUserIds: listProjectMemberUserIdsMock,
	listProjects: listProjectsMock,
	listProjectsWithTaskCount: listProjectsWithTaskCountMock,
	nextProjectSortOrder: nextProjectSortOrderMock,
	replaceProjectMembers: replaceProjectMembersMock,
	updateProjectById: updateProjectByIdMock,
	updateProjectSortOrder: updateProjectSortOrderMock,
	updateProjectWhereUpdatedAt: updateProjectWhereUpdatedAtMock
}));

import { updateProjectUseCase } from './usecases';

describe('projects usecases additional coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('updateProjectUseCase should treat an undefined name as a no-op', async () => {
		const existing = {
			id: 'project-1',
			name: '既存',
			sortOrder: 0,
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		};
		findProjectByIdMock.mockResolvedValueOnce(existing);

		await expect(
			updateProjectUseCase('project-1', {
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toEqual(existing);
		expect(updateProjectWhereUpdatedAtMock).not.toHaveBeenCalled();
	});

	it('updateProjectUseCase should update directly when optimistic lock succeeds', async () => {
		findProjectByIdMock.mockResolvedValueOnce({
			id: 'project-1',
			name: '既存',
			sortOrder: 0,
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		});
		updateProjectWhereUpdatedAtMock.mockResolvedValueOnce(1);
		updateProjectByIdMock.mockResolvedValueOnce({
			id: 'project-1',
			name: '更新後',
			sortOrder: 0,
			updatedAt: new Date('2026-03-02T00:00:00.000Z')
		});

		await expect(
			updateProjectUseCase('project-1', {
				name: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toEqual({
			id: 'project-1',
			name: '更新後',
			sortOrder: 0,
			updatedAt: new Date('2026-03-02T00:00:00.000Z')
		});
	});

	it('updateProjectUseCase should return null when the locked row disappears before fallback', async () => {
		findProjectByIdMock.mockResolvedValueOnce({
			id: 'project-1',
			name: '既存',
			sortOrder: 0,
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		});
		updateProjectWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findProjectUpdatedAtByIdMock.mockResolvedValueOnce(null);

		await expect(
			updateProjectUseCase('project-1', {
				name: '更新',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toBeNull();
		expect(updateProjectByIdMock).not.toHaveBeenCalled();
	});
});
