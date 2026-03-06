import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	createUserUseCaseMock,
	deleteUserUseCaseMock,
	listUserSummariesUseCaseMock,
	listUsersUseCaseMock,
	updateUserUseCaseMock,
	UserModelValidationErrorMock,
	UserOptimisticLockErrorMock
} = vi.hoisted(() => {
	class UserModelValidationErrorMock extends Error {}
	class UserOptimisticLockErrorMock extends Error {}

	return {
		createUserUseCaseMock: vi.fn(),
		deleteUserUseCaseMock: vi.fn(),
		listUserSummariesUseCaseMock: vi.fn(),
		listUsersUseCaseMock: vi.fn(),
		updateUserUseCaseMock: vi.fn(),
		UserModelValidationErrorMock,
		UserOptimisticLockErrorMock
	};
});

vi.mock('./usecases', () => ({
	createUserUseCase: createUserUseCaseMock,
	deleteUserUseCase: deleteUserUseCaseMock,
	listUserSummariesUseCase: listUserSummariesUseCaseMock,
	listUsersUseCase: listUsersUseCaseMock,
	updateUserUseCase: updateUserUseCaseMock,
	UserModelValidationError: UserModelValidationErrorMock,
	UserOptimisticLockError: UserOptimisticLockErrorMock
}));

import { createApp } from '../../app';

describe('user routes additional cases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('DELETE /api/users/:id should return 404 when user does not exist', async () => {
		deleteUserUseCaseMock.mockResolvedValueOnce(false);

		const response = await createApp().request('/api/users/user-missing', {
			method: 'DELETE'
		});

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'user not found' });
	});

	it('GET /api/users should return 400 when listing fails with a validation error', async () => {
		listUsersUseCaseMock.mockRejectedValueOnce(
			new UserModelValidationErrorMock('user list validation failed')
		);

		const response = await createApp().request('/api/users');

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'user list validation failed'
		});
	});

	it('GET /api/users/summary should return 400 when listing fails with a validation error', async () => {
		listUserSummariesUseCaseMock.mockRejectedValueOnce(
			new UserModelValidationErrorMock('user summary validation failed')
		);

		const response = await createApp().request('/api/users/summary');

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'user summary validation failed'
		});
	});

	it('POST /api/users should return 400 when creation fails with a validation error', async () => {
		createUserUseCaseMock.mockRejectedValueOnce(
			new UserModelValidationErrorMock('user creation validation failed')
		);

		const response = await createApp().request('/api/users', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: '田中'
			})
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'user creation validation failed'
		});
	});

	it('PATCH /api/users/:id should return the updated user', async () => {
		updateUserUseCaseMock.mockResolvedValueOnce({
			id: 'user-1',
			name: '更新後',
			updatedAt: new Date('2026-03-02T00:00:00.000Z')
		});

		const response = await createApp().request('/api/users/user-1', {
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
			id: 'user-1',
			name: '更新後',
			updatedAt: '2026-03-02T00:00:00.000Z'
		});
	});
});
