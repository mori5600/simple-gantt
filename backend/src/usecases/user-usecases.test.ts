import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	listUsersMock,
	listUsersWithTaskCountMock,
	createUserRecordMock,
	findUserByIdMock,
	updateUserWhereUpdatedAtMock,
	updateUserByIdMock,
	findUserUpdatedAtByIdMock,
	findUserAssigneeCountByIdMock,
	deleteUserByIdMock
} = vi.hoisted(() => ({
	listUsersMock: vi.fn(),
	listUsersWithTaskCountMock: vi.fn(),
	createUserRecordMock: vi.fn(),
	findUserByIdMock: vi.fn(),
	updateUserWhereUpdatedAtMock: vi.fn(),
	updateUserByIdMock: vi.fn(),
	findUserUpdatedAtByIdMock: vi.fn(),
	findUserAssigneeCountByIdMock: vi.fn(),
	deleteUserByIdMock: vi.fn()
}));

vi.mock('../models/user-model', () => ({
	listUsers: listUsersMock,
	listUsersWithTaskCount: listUsersWithTaskCountMock,
	createUserRecord: createUserRecordMock,
	findUserById: findUserByIdMock,
	updateUserWhereUpdatedAt: updateUserWhereUpdatedAtMock,
	updateUserById: updateUserByIdMock,
	findUserUpdatedAtById: findUserUpdatedAtByIdMock,
	findUserAssigneeCountById: findUserAssigneeCountByIdMock,
	deleteUserById: deleteUserByIdMock
}));

import {
	createUserUseCase,
	deleteUserUseCase,
	listUserSummariesUseCase,
	listUsersUseCase,
	updateUserUseCase,
	UserModelValidationError,
	UserOptimisticLockError
} from './user-usecases';

describe('user-usecases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('listUsersUseCase should return users', async () => {
		const rows = [{ id: 'user-1', name: '伊藤', updatedAt: new Date('2026-02-19T00:00:00.000Z') }];
		listUsersMock.mockResolvedValueOnce(rows);

		await expect(listUsersUseCase()).resolves.toEqual(rows);
		expect(listUsersMock).toHaveBeenCalledTimes(1);
	});

	it('listUserSummariesUseCase should return user summaries', async () => {
		const rows = [
			{
				id: 'user-1',
				name: '伊藤',
				updatedAt: new Date('2026-02-19T00:00:00.000Z'),
				taskCount: 2
			}
		];
		listUsersWithTaskCountMock.mockResolvedValueOnce(rows);

		await expect(listUserSummariesUseCase()).resolves.toEqual(rows);
		expect(listUsersWithTaskCountMock).toHaveBeenCalledTimes(1);
	});

	it('createUserUseCase should create user with generated id', async () => {
		const randomUUIDMock = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('uuid-1');
		createUserRecordMock.mockResolvedValueOnce({
			id: 'user-uuid-1',
			name: '田中',
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});

		const actual = await createUserUseCase({ name: '田中' });

		expect(createUserRecordMock).toHaveBeenCalledWith({
			id: 'user-uuid-1',
			name: '田中'
		});
		expect(actual).toEqual({
			id: 'user-uuid-1',
			name: '田中',
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});
		randomUUIDMock.mockRestore();
	});

	it('updateUserUseCase should return null when user does not exist', async () => {
		findUserByIdMock.mockResolvedValueOnce(null);

		await expect(
			updateUserUseCase('user-missing', {
				name: '更新',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		).resolves.toBeNull();
		expect(updateUserWhereUpdatedAtMock).not.toHaveBeenCalled();
	});

	it('updateUserUseCase should return existing user for no-op update', async () => {
		const existing = {
			id: 'user-1',
			name: '田中',
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		};
		findUserByIdMock.mockResolvedValueOnce(existing);

		await expect(
			updateUserUseCase('user-1', {
				name: '田中',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		).resolves.toEqual(existing);
		expect(updateUserWhereUpdatedAtMock).not.toHaveBeenCalled();
		expect(updateUserByIdMock).not.toHaveBeenCalled();
	});

	it('updateUserUseCase should throw optimistic lock error on timestamp mismatch', async () => {
		findUserByIdMock.mockResolvedValueOnce({
			id: 'user-1',
			name: '伊藤',
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});

		await expect(
			updateUserUseCase('user-1', {
				name: '更新',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		).rejects.toBeInstanceOf(UserOptimisticLockError);
		expect(updateUserWhereUpdatedAtMock).not.toHaveBeenCalled();
	});

	it('updateUserUseCase should throw optimistic lock error on concurrent update', async () => {
		findUserByIdMock.mockResolvedValueOnce({
			id: 'user-1',
			name: '伊藤',
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});
		updateUserWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findUserUpdatedAtByIdMock.mockResolvedValueOnce(new Date('2026-02-20T00:00:00.000Z'));

		await expect(
			updateUserUseCase('user-1', {
				name: '更新',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		).rejects.toBeInstanceOf(UserOptimisticLockError);
		expect(updateUserByIdMock).not.toHaveBeenCalled();
	});

	it('updateUserUseCase should fallback-update when updatedAt is unchanged', async () => {
		findUserByIdMock.mockResolvedValueOnce({
			id: 'user-1',
			name: '伊藤',
			updatedAt: new Date('2026-02-19T00:00:00.000Z')
		});
		updateUserWhereUpdatedAtMock.mockResolvedValueOnce(0);
		findUserUpdatedAtByIdMock.mockResolvedValueOnce(new Date('2026-02-19T00:00:00.000Z'));
		updateUserByIdMock.mockResolvedValueOnce({
			id: 'user-1',
			name: '更新',
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});

		const actual = await updateUserUseCase('user-1', {
			name: '更新',
			updatedAt: '2026-02-19T00:00:00.000Z'
		});

		expect(updateUserByIdMock).toHaveBeenCalledWith('user-1', '更新');
		expect(actual).toEqual({
			id: 'user-1',
			name: '更新',
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});
	});

	it('deleteUserUseCase should return false when user does not exist', async () => {
		findUserAssigneeCountByIdMock.mockResolvedValueOnce(null);

		await expect(deleteUserUseCase('user-missing')).resolves.toBe(false);
		expect(deleteUserByIdMock).not.toHaveBeenCalled();
	});

	it('deleteUserUseCase should reject when assigned tasks exist', async () => {
		findUserAssigneeCountByIdMock.mockResolvedValueOnce(1);

		await expect(deleteUserUseCase('user-1')).rejects.toBeInstanceOf(UserModelValidationError);
		expect(deleteUserByIdMock).not.toHaveBeenCalled();
	});

	it('deleteUserUseCase should delete user when assignment does not exist', async () => {
		findUserAssigneeCountByIdMock.mockResolvedValueOnce(0);
		deleteUserByIdMock.mockResolvedValueOnce(undefined);

		await expect(deleteUserUseCase('user-1')).resolves.toBe(true);
		expect(deleteUserByIdMock).toHaveBeenCalledWith('user-1');
	});
});
