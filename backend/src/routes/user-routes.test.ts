import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	listUsersUseCaseMock,
	listUserSummariesUseCaseMock,
	createUserUseCaseMock,
	updateUserUseCaseMock,
	deleteUserUseCaseMock,
	UserModelValidationErrorMock,
	UserOptimisticLockErrorMock
} = vi.hoisted(() => {
	class UserModelValidationErrorMock extends Error {}
	class UserOptimisticLockErrorMock extends Error {}

	return {
		listUsersUseCaseMock: vi.fn(),
		listUserSummariesUseCaseMock: vi.fn(),
		createUserUseCaseMock: vi.fn(),
		updateUserUseCaseMock: vi.fn(),
		deleteUserUseCaseMock: vi.fn(),
		UserModelValidationErrorMock,
		UserOptimisticLockErrorMock
	};
});

vi.mock('../usecases/user-usecases', () => ({
	listUsersUseCase: listUsersUseCaseMock,
	listUserSummariesUseCase: listUserSummariesUseCaseMock,
	createUserUseCase: createUserUseCaseMock,
	updateUserUseCase: updateUserUseCaseMock,
	deleteUserUseCase: deleteUserUseCaseMock,
	UserModelValidationError: UserModelValidationErrorMock,
	UserOptimisticLockError: UserOptimisticLockErrorMock
}));

import { createApp } from '../app';

describe('user routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET /api/users should return users', async () => {
		listUsersUseCaseMock.mockResolvedValueOnce([
			{
				id: 'user-1',
				name: '伊藤',
				updatedAt: new Date('2026-02-19T00:00:00.000Z')
			}
		]);

		const response = await createApp().request('/api/users');
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual([
			{
				id: 'user-1',
				name: '伊藤',
				updatedAt: '2026-02-19T00:00:00.000Z'
			}
		]);
	});

	it('GET /api/users/summary should return users with taskCount', async () => {
		listUserSummariesUseCaseMock.mockResolvedValueOnce([
			{
				id: 'user-1',
				name: '伊藤',
				updatedAt: new Date('2026-02-19T00:00:00.000Z'),
				taskCount: 3
			}
		]);

		const response = await createApp().request('/api/users/summary');
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual([
			{
				id: 'user-1',
				name: '伊藤',
				updatedAt: '2026-02-19T00:00:00.000Z',
				taskCount: 3
			}
		]);
	});

	it('POST /api/users should create user', async () => {
		createUserUseCaseMock.mockResolvedValueOnce({
			id: 'user-2',
			name: '田中',
			updatedAt: new Date('2026-02-20T00:00:00.000Z')
		});

		const response = await createApp().request('/api/users', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ name: '田中' })
		});
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(createUserUseCaseMock).toHaveBeenCalledWith({ name: '田中' });
		expect(body).toEqual({
			id: 'user-2',
			name: '田中',
			updatedAt: '2026-02-20T00:00:00.000Z'
		});
	});

	it('POST /api/users should return 400 for invalid payload', async () => {
		const response = await createApp().request('/api/users', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ name: '' })
		});

		expect(response.status).toBe(400);
	});

	it('PATCH /api/users/:id should return 404 when user does not exist', async () => {
		updateUserUseCaseMock.mockResolvedValueOnce(null);

		const response = await createApp().request('/api/users/user-missing', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: '更新',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		});
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toEqual({ error: 'user not found' });
	});

	it('PATCH /api/users/:id should return 409 on optimistic lock conflict', async () => {
		updateUserUseCaseMock.mockRejectedValueOnce(
			new UserOptimisticLockErrorMock(
				'user は他ユーザーによって更新されました。再読み込みして再度お試しください。'
			)
		);

		const response = await createApp().request('/api/users/user-1', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: '更新',
				updatedAt: '2026-02-19T00:00:00.000Z'
			})
		});
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body).toEqual({
			error: 'user は他ユーザーによって更新されました。再読み込みして再度お試しください。'
		});
	});

	it('DELETE /api/users/:id should delete user', async () => {
		deleteUserUseCaseMock.mockResolvedValueOnce(true);

		const response = await createApp().request('/api/users/user-1', {
			method: 'DELETE'
		});

		expect(response.status).toBe(204);
		expect(deleteUserUseCaseMock).toHaveBeenCalledWith('user-1');
	});

	it('DELETE /api/users/:id should return 400 for validation error', async () => {
		deleteUserUseCaseMock.mockRejectedValueOnce(
			new UserModelValidationErrorMock('担当タスクが存在するユーザーは削除できません。')
		);

		const response = await createApp().request('/api/users/user-1', {
			method: 'DELETE'
		});
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({ error: '担当タスクが存在するユーザーは削除できません。' });
	});
});
