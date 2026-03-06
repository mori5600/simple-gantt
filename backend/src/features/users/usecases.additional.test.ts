import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	createUserRecordMock,
	deleteUserByIdMock,
	findUserAssigneeCountByIdMock,
	findUserByIdMock,
	findUserUpdatedAtByIdMock,
	listUsersMock,
	listUsersWithTaskCountMock,
	updateUserByIdMock,
	updateUserWhereUpdatedAtMock
} = vi.hoisted(() => ({
	createUserRecordMock: vi.fn(),
	deleteUserByIdMock: vi.fn(),
	findUserAssigneeCountByIdMock: vi.fn(),
	findUserByIdMock: vi.fn(),
	findUserUpdatedAtByIdMock: vi.fn(),
	listUsersMock: vi.fn(),
	listUsersWithTaskCountMock: vi.fn(),
	updateUserByIdMock: vi.fn(),
	updateUserWhereUpdatedAtMock: vi.fn()
}));

vi.mock('./repository', () => ({
	createUserRecord: createUserRecordMock,
	deleteUserById: deleteUserByIdMock,
	findUserAssigneeCountById: findUserAssigneeCountByIdMock,
	findUserById: findUserByIdMock,
	findUserUpdatedAtById: findUserUpdatedAtByIdMock,
	listUsers: listUsersMock,
	listUsersWithTaskCount: listUsersWithTaskCountMock,
	updateUserById: updateUserByIdMock,
	updateUserWhereUpdatedAt: updateUserWhereUpdatedAtMock
}));

import { updateUserUseCase } from './usecases';

describe('users usecases additional coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('updateUserUseCase should treat an undefined name as a no-op', async () => {
		const existing = {
			id: 'user-1',
			name: '既存',
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		};
		findUserByIdMock.mockResolvedValueOnce(existing);

		await expect(
			updateUserUseCase('user-1', {
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toEqual(existing);
		expect(updateUserWhereUpdatedAtMock).not.toHaveBeenCalled();
	});

	it('updateUserUseCase should update directly when optimistic lock succeeds', async () => {
		findUserByIdMock.mockResolvedValueOnce({
			id: 'user-1',
			name: '既存',
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		});
		updateUserWhereUpdatedAtMock.mockResolvedValueOnce(1);
		updateUserByIdMock.mockResolvedValueOnce({
			id: 'user-1',
			name: '更新後',
			updatedAt: new Date('2026-03-02T00:00:00.000Z')
		});

		await expect(
			updateUserUseCase('user-1', {
				name: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toEqual({
			id: 'user-1',
			name: '更新後',
			updatedAt: new Date('2026-03-02T00:00:00.000Z')
		});
	});

	it('updateUserUseCase should return null when the locked row disappears before fallback', async () => {
		findUserByIdMock.mockResolvedValueOnce({
			id: 'user-1',
			name: '既存',
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		});
		updateUserWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findUserUpdatedAtByIdMock.mockResolvedValueOnce(null);

		await expect(
			updateUserUseCase('user-1', {
				name: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toBeNull();
		expect(updateUserByIdMock).not.toHaveBeenCalled();
	});
});
