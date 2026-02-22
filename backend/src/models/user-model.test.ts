import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
	prismaMock: {
		user: {
			findMany: vi.fn(),
			create: vi.fn(),
			findUnique: vi.fn(),
			updateMany: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		}
	}
}));

vi.mock('./db', () => ({
	prisma: prismaMock
}));

import {
	createUserRecord,
	deleteUserById,
	findUserAssigneeCountById,
	findUserById,
	findUserUpdatedAtById,
	listUsers,
	listUsersWithTaskCount,
	updateUserById,
	updateUserWhereUpdatedAt
} from './user-model';

describe('user-model', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('listUsers should request sorted users', async () => {
		const rows = [
			{ id: 'user-1', name: '伊藤', updatedAt: new Date('2026-02-19T00:00:00.000Z') },
			{ id: 'user-2', name: '佐藤', updatedAt: new Date('2026-02-19T00:00:00.000Z') }
		];
		prismaMock.user.findMany.mockResolvedValueOnce(rows);

		const actual = await listUsers();

		expect(prismaMock.user.findMany).toHaveBeenCalledWith({
			orderBy: [{ name: 'asc' }, { id: 'asc' }]
		});
		expect(actual).toEqual(rows);
	});

	it('listUsersWithTaskCount should map _count.assignees to taskCount', async () => {
		prismaMock.user.findMany.mockResolvedValueOnce([
			{
				id: 'user-1',
				name: '伊藤',
				updatedAt: new Date('2026-02-19T00:00:00.000Z'),
				_count: {
					assignees: 2
				}
			}
		]);

		const actual = await listUsersWithTaskCount();

		expect(prismaMock.user.findMany).toHaveBeenCalledWith({
			orderBy: [{ name: 'asc' }, { id: 'asc' }],
			select: {
				id: true,
				name: true,
				updatedAt: true,
				_count: {
					select: {
						assignees: true
					}
				}
			}
		});
		expect(actual).toEqual([
			{
				id: 'user-1',
				name: '伊藤',
				updatedAt: new Date('2026-02-19T00:00:00.000Z'),
				taskCount: 2
			}
		]);
	});

	it('createUserRecord should persist id and name', async () => {
		prismaMock.user.create.mockImplementationOnce(
			async (args: { data: { id: string; name: string } }) => ({
				id: args.data.id,
				name: args.data.name,
				updatedAt: new Date('2026-02-19T00:00:00.000Z')
			})
		);

		const actual = await createUserRecord({ id: 'user-10', name: '田中' });

		expect(prismaMock.user.create).toHaveBeenCalledWith({
			data: {
				id: 'user-10',
				name: '田中'
			}
		});
		expect(actual).toEqual({
			id: 'user-10',
			name: '田中',
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});
	});

	it('findUserById should return selected record', async () => {
		prismaMock.user.findUnique.mockResolvedValueOnce({
			id: 'user-1',
			name: '伊藤',
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});

		const actual = await findUserById('user-1');

		expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
			where: {
				id: 'user-1'
			},
			select: {
				id: true,
				name: true,
				updatedAt: true
			}
		});
		expect(actual).toEqual({
			id: 'user-1',
			name: '伊藤',
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});
	});

	it('updateUserWhereUpdatedAt should return updated count', async () => {
		prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });

		const actual = await updateUserWhereUpdatedAt({
			userId: 'user-1',
			expectedUpdatedAt: new Date('2026-02-19T00:00:00.000Z'),
			name: '更新'
		});

		expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
			where: {
				id: 'user-1',
				updatedAt: new Date('2026-02-19T00:00:00.000Z')
			},
			data: {
				name: '更新'
			}
		});
		expect(actual).toBe(1);
	});

	it('updateUserById should return selected record', async () => {
		prismaMock.user.update.mockResolvedValueOnce({
			id: 'user-1',
			name: '更新',
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});

		const actual = await updateUserById('user-1', '更新');

		expect(prismaMock.user.update).toHaveBeenCalledWith({
			where: {
				id: 'user-1'
			},
			data: {
				name: '更新'
			},
			select: {
				id: true,
				name: true,
				updatedAt: true
			}
		});
		expect(actual).toEqual({
			id: 'user-1',
			name: '更新',
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});
	});

	it('findUserUpdatedAtById should return updatedAt or null', async () => {
		prismaMock.user.findUnique
			.mockResolvedValueOnce({ updatedAt: new Date('2026-02-20T00:00:00.000Z') })
			.mockResolvedValueOnce(null);

		await expect(findUserUpdatedAtById('user-1')).resolves.toEqual(
			new Date('2026-02-20T00:00:00.000Z')
		);
		await expect(findUserUpdatedAtById('user-2')).resolves.toBeNull();
	});

	it('findUserAssigneeCountById should return count or null', async () => {
		prismaMock.user.findUnique
			.mockResolvedValueOnce({ id: 'user-1', _count: { assignees: 3 } })
			.mockResolvedValueOnce(null);

		await expect(findUserAssigneeCountById('user-1')).resolves.toBe(3);
		await expect(findUserAssigneeCountById('user-2')).resolves.toBeNull();
	});

	it('deleteUserById should delete by id', async () => {
		prismaMock.user.delete.mockResolvedValueOnce({ id: 'user-1' });

		await deleteUserById('user-1');

		expect(prismaMock.user.delete).toHaveBeenCalledWith({
			where: {
				id: 'user-1'
			}
		});
	});
});
