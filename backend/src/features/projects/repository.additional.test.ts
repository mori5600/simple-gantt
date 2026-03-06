import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
	prismaMock: {
		project: {
			aggregate: vi.fn(),
			create: vi.fn(),
			deleteMany: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn()
		},
		projectMember: {
			createMany: vi.fn(),
			deleteMany: vi.fn(),
			findMany: vi.fn()
		},
		taskAssignee: {
			count: vi.fn()
		},
		user: {
			count: vi.fn(),
			findMany: vi.fn()
		}
	}
}));

vi.mock('../../platform/prisma', () => ({
	prisma: prismaMock
}));

import {
	countTaskAssignmentsForUsersInProject,
	countUsersByIds,
	createProjectRecord,
	deleteProjectById,
	findProjectById,
	findProjectTaskCountById,
	findProjectUpdatedAtById,
	listProjectIds,
	listProjectMemberUserIds,
	listProjectMembers,
	nextProjectSortOrder,
	replaceProjectMembers,
	updateProjectById,
	updateProjectSortOrder,
	updateProjectWhereUpdatedAt
} from './repository';

describe('projects repository additional coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('nextProjectSortOrder should return zero when no project exists', async () => {
		prismaMock.project.aggregate.mockResolvedValueOnce({ _max: { sortOrder: null } });

		await expect(nextProjectSortOrder()).resolves.toBe(0);
	});

	it('createProjectRecord should persist and map a project', async () => {
		prismaMock.project.create.mockResolvedValueOnce({
			id: 'project-1',
			name: '開発',
			sortOrder: 2,
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		});

		await expect(
			createProjectRecord({
				id: 'project-1',
				name: '開発',
				sortOrder: 2
			})
		).resolves.toEqual({
			id: 'project-1',
			name: '開発',
			sortOrder: 2,
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		});
	});

	it('findProjectById should request the selected fields', async () => {
		prismaMock.project.findUnique.mockResolvedValueOnce({
			id: 'project-1',
			name: '開発',
			sortOrder: 1,
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		});

		await findProjectById('project-1');

		expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
			where: {
				id: 'project-1'
			},
			select: {
				id: true,
				name: true,
				sortOrder: true,
				updatedAt: true
			}
		});
	});

	it('updateProjectWhereUpdatedAt should return the updated count', async () => {
		prismaMock.project.updateMany.mockResolvedValueOnce({ count: 1 });

		await expect(
			updateProjectWhereUpdatedAt({
				projectId: 'project-1',
				expectedUpdatedAt: new Date('2026-03-01T00:00:00.000Z'),
				name: '更新'
			})
		).resolves.toBe(1);
	});

	it('updateProjectById should return the selected record', async () => {
		prismaMock.project.update.mockResolvedValueOnce({
			id: 'project-1',
			name: '更新',
			sortOrder: 1,
			updatedAt: new Date('2026-03-02T00:00:00.000Z')
		});

		await expect(updateProjectById('project-1', '更新')).resolves.toEqual({
			id: 'project-1',
			name: '更新',
			sortOrder: 1,
			updatedAt: new Date('2026-03-02T00:00:00.000Z')
		});
	});

	it('findProjectUpdatedAtById should return updatedAt or null', async () => {
		prismaMock.project.findUnique
			.mockResolvedValueOnce({ updatedAt: new Date('2026-03-02T00:00:00.000Z') })
			.mockResolvedValueOnce(null);

		await expect(findProjectUpdatedAtById('project-1')).resolves.toEqual(
			new Date('2026-03-02T00:00:00.000Z')
		);
		await expect(findProjectUpdatedAtById('project-missing')).resolves.toBeNull();
	});

	it('findProjectTaskCountById should return task counts or null', async () => {
		prismaMock.project.findUnique
			.mockResolvedValueOnce({ id: 'project-1', _count: { tasks: 3 } })
			.mockResolvedValueOnce(null);

		await expect(findProjectTaskCountById('project-1')).resolves.toBe(3);
		await expect(findProjectTaskCountById('project-missing')).resolves.toBeNull();
	});

	it('deleteProjectById should convert delete counts to booleans', async () => {
		prismaMock.project.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({
			count: 0
		});

		await expect(deleteProjectById('project-1')).resolves.toBe(true);
		await expect(deleteProjectById('project-missing')).resolves.toBe(false);
	});

	it('listProjectIds should map project ids', async () => {
		prismaMock.project.findMany.mockResolvedValueOnce([{ id: 'project-1' }, { id: 'project-2' }]);

		await expect(listProjectIds()).resolves.toEqual(['project-1', 'project-2']);
	});

	it('updateProjectSortOrder should persist the new sort order', async () => {
		prismaMock.project.update.mockResolvedValueOnce({ id: 'project-1' });

		await updateProjectSortOrder('project-1', 3);

		expect(prismaMock.project.update).toHaveBeenCalledWith({
			where: {
				id: 'project-1'
			},
			data: {
				sortOrder: 3
			}
		});
	});

	it('listProjectMemberUserIds should map member rows to user ids', async () => {
		prismaMock.projectMember.findMany.mockResolvedValueOnce([
			{ userId: 'user-1' },
			{ userId: 'user-2' }
		]);

		await expect(listProjectMemberUserIds('project-1')).resolves.toEqual(['user-1', 'user-2']);
	});

	it('listProjectMembers should request members through project memberships', async () => {
		prismaMock.user.findMany.mockResolvedValueOnce([
			{
				id: 'user-1',
				name: '伊藤',
				updatedAt: new Date('2026-03-01T00:00:00.000Z')
			}
		]);

		await listProjectMembers('project-1');

		expect(prismaMock.user.findMany).toHaveBeenCalledWith({
			where: {
				projectMemberships: {
					some: {
						projectId: 'project-1'
					}
				}
			},
			orderBy: [{ name: 'asc' }, { id: 'asc' }],
			select: {
				id: true,
				name: true,
				updatedAt: true
			}
		});
	});

	it('countUsersByIds should skip empty lists and count existing users', async () => {
		prismaMock.user.count.mockResolvedValueOnce(2);

		await expect(countUsersByIds([])).resolves.toBe(0);
		await expect(countUsersByIds(['user-1', 'user-2'])).resolves.toBe(2);
	});

	it('countTaskAssignmentsForUsersInProject should skip empty lists and count assignments', async () => {
		prismaMock.taskAssignee.count.mockResolvedValueOnce(1);

		await expect(countTaskAssignmentsForUsersInProject('project-1', [])).resolves.toBe(0);
		await expect(countTaskAssignmentsForUsersInProject('project-1', ['user-1'])).resolves.toBe(1);
	});

	it('replaceProjectMembers should delete memberships and skip inserts when list is empty', async () => {
		await replaceProjectMembers('project-1', []);

		expect(prismaMock.projectMember.deleteMany).toHaveBeenCalledWith({
			where: {
				projectId: 'project-1'
			}
		});
		expect(prismaMock.projectMember.createMany).not.toHaveBeenCalled();
	});

	it('replaceProjectMembers should recreate memberships when user ids are provided', async () => {
		await replaceProjectMembers('project-1', ['user-1', 'user-2']);

		expect(prismaMock.projectMember.createMany).toHaveBeenCalledWith({
			data: [
				{
					projectId: 'project-1',
					userId: 'user-1'
				},
				{
					projectId: 'project-1',
					userId: 'user-2'
				}
			]
		});
	});
});
