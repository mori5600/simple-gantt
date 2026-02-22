import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
	prismaMock: {
		project: {
			findMany: vi.fn()
		}
	}
}));

vi.mock('./db', () => ({
	prisma: prismaMock
}));

import { listProjects, listProjectsWithTaskCount } from './project-model';

describe('project-model', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('listProjects should request sorted projects', async () => {
		const rows = [
			{
				id: 'project-1',
				name: 'A',
				sortOrder: 0,
				updatedAt: new Date('2026-02-19T00:00:00.000Z')
			}
		];
		prismaMock.project.findMany.mockResolvedValueOnce(rows);

		const actual = await listProjects();

		expect(prismaMock.project.findMany).toHaveBeenCalledWith({
			orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }]
		});
		expect(actual).toEqual(rows);
	});

	it('listProjectsWithTaskCount should map _count.tasks to taskCount', async () => {
		prismaMock.project.findMany.mockResolvedValueOnce([
			{
				id: 'project-1',
				name: 'A',
				sortOrder: 0,
				updatedAt: new Date('2026-02-19T00:00:00.000Z'),
				_count: {
					tasks: 4
				}
			}
		]);

		const actual = await listProjectsWithTaskCount();

		expect(prismaMock.project.findMany).toHaveBeenCalledWith({
			orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
			select: {
				id: true,
				name: true,
				sortOrder: true,
				updatedAt: true,
				_count: {
					select: {
						tasks: true
					}
				}
			}
		});
		expect(actual).toEqual([
			{
				id: 'project-1',
				name: 'A',
				sortOrder: 0,
				updatedAt: new Date('2026-02-19T00:00:00.000Z'),
				taskCount: 4
			}
		]);
	});
});
