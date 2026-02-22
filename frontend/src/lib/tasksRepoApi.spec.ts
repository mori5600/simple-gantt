import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMocks = vi.hoisted(() => {
	const client = {
		get: vi.fn(),
		post: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn()
	};
	const create = vi.fn(() => client);
	const isAxiosError = vi.fn((error: unknown) => {
		return Boolean((error as { isAxiosError?: boolean } | null)?.isAxiosError);
	});
	return {
		client,
		create,
		isAxiosError
	};
});

vi.mock('axios', () => {
	return {
		default: {
			create: axiosMocks.create,
			isAxiosError: axiosMocks.isAxiosError
		}
	};
});

import { apiTasksRepo } from './tasksRepoApi';

describe('apiTasksRepo', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('listProjects should reject invalid response payload', async () => {
		axiosMocks.client.get.mockResolvedValueOnce({
			data: [
				{
					name: 'Broken project',
					sortOrder: 0,
					updatedAt: '2026-02-20T00:00:00.000Z'
				}
			]
		});

		await expect(apiTasksRepo.listProjects()).rejects.toThrow('APIレスポンスの形式が不正です。');
	});

	it('create should reject invalid task payload from API', async () => {
		axiosMocks.client.post.mockResolvedValueOnce({
			data: {
				id: 'task-1',
				title: 'Broken task'
			}
		});

		await expect(
			apiTasksRepo.create('project-1', {
				title: 'new',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: null
			})
		).rejects.toThrow('APIレスポンスの形式が不正です。');
	});

	it('listProjects should keep server error messages for axios errors', async () => {
		axiosMocks.client.get.mockRejectedValueOnce({
			isAxiosError: true,
			response: {
				data: {
					message: 'server said no'
				}
			},
			message: 'Request failed'
		});

		await expect(apiTasksRepo.listProjects()).rejects.toThrow('server said no');
	});
});
