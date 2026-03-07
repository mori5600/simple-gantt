import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMocks = vi.hoisted(() => {
	const client = {
		get: vi.fn(),
		post: vi.fn(),
		patch: vi.fn(),
		put: vi.fn(),
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

import { apiTasksRepo } from './repoApi';

function projectFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 'project-1',
		name: 'Project 1',
		sortOrder: 0,
		updatedAt: '2026-03-01T00:00:00.000Z',
		...overrides
	};
}

function projectSummaryFixture(overrides: Record<string, unknown> = {}) {
	return {
		...projectFixture(),
		taskCount: 2,
		...overrides
	};
}

function userFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 'user-1',
		name: '伊藤',
		updatedAt: '2026-03-01T00:00:00.000Z',
		...overrides
	};
}

function userSummaryFixture(overrides: Record<string, unknown> = {}) {
	return {
		...userFixture(),
		taskCount: 3,
		...overrides
	};
}

function taskFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 'task-1',
		projectId: 'project-1',
		title: '要件確認',
		startDate: '2026-03-01',
		endDate: '2026-03-03',
		progress: 20,
		note: '',
		sortOrder: 0,
		updatedAt: '2026-03-01T00:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: null,
		...overrides
	};
}

function taskHistoryFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 'history-1',
		taskId: 'task-1',
		projectId: 'project-1',
		action: 'updated',
		changedFields: ['title'],
		title: '要件確認',
		note: '',
		startDate: '2026-03-01',
		endDate: '2026-03-03',
		progress: 20,
		assigneeIds: [],
		predecessorTaskId: null,
		createdAt: '2026-03-01T01:00:00.000Z',
		...overrides
	};
}

describe('apiTasksRepo', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('project endpoints should parse successful responses', async () => {
		axiosMocks.client.get
			.mockResolvedValueOnce({ data: [projectFixture()] })
			.mockResolvedValueOnce({ data: [projectSummaryFixture()] });
		axiosMocks.client.post.mockResolvedValueOnce({ data: projectFixture({ id: 'project-2' }) });
		axiosMocks.client.patch.mockResolvedValueOnce({ data: projectFixture({ name: 'Renamed' }) });
		axiosMocks.client.post.mockResolvedValueOnce({ data: [projectFixture({ sortOrder: 1 })] });
		axiosMocks.client.delete.mockResolvedValueOnce(undefined);

		await expect(apiTasksRepo.listProjects()).resolves.toEqual([projectFixture()]);
		await expect(apiTasksRepo.listProjectSummaries()).resolves.toEqual([projectSummaryFixture()]);
		await expect(apiTasksRepo.createProject({ name: 'Project 2' })).resolves.toEqual(
			projectFixture({ id: 'project-2' })
		);
		await expect(
			apiTasksRepo.updateProject('project-1', {
				name: 'Renamed',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toEqual(projectFixture({ name: 'Renamed' }));
		await expect(apiTasksRepo.reorderProjects(['project-1'])).resolves.toEqual([
			projectFixture({ sortOrder: 1 })
		]);
		await expect(apiTasksRepo.removeProject('project-1')).resolves.toBeUndefined();

		expect(axiosMocks.client.get).toHaveBeenNthCalledWith(1, '/api/projects');
		expect(axiosMocks.client.get).toHaveBeenNthCalledWith(2, '/api/projects/summary');
		expect(axiosMocks.client.post).toHaveBeenNthCalledWith(1, '/api/projects', {
			name: 'Project 2'
		});
		expect(axiosMocks.client.patch).toHaveBeenCalledWith('/api/projects/project-1', {
			name: 'Renamed',
			updatedAt: '2026-03-01T00:00:00.000Z'
		});
		expect(axiosMocks.client.post).toHaveBeenNthCalledWith(2, '/api/projects/reorder', {
			ids: ['project-1']
		});
		expect(axiosMocks.client.delete).toHaveBeenCalledWith('/api/projects/project-1');
	});

	it('member and user endpoints should parse successful responses', async () => {
		axiosMocks.client.get
			.mockResolvedValueOnce({ data: [userFixture()] })
			.mockResolvedValueOnce({ data: [userFixture({ id: 'user-2' })] })
			.mockResolvedValueOnce({ data: [userSummaryFixture()] });
		axiosMocks.client.put.mockResolvedValueOnce({ data: [userFixture()] });
		axiosMocks.client.post.mockResolvedValueOnce({ data: userFixture({ id: 'user-3' }) });
		axiosMocks.client.patch.mockResolvedValueOnce({ data: userFixture({ name: '佐藤' }) });
		axiosMocks.client.delete.mockResolvedValueOnce(undefined);

		await expect(apiTasksRepo.listProjectMembers('project-1')).resolves.toEqual([userFixture()]);
		await expect(apiTasksRepo.setProjectMembers('project-1', ['user-1'])).resolves.toEqual([
			userFixture()
		]);
		await expect(apiTasksRepo.listUsers()).resolves.toEqual([userFixture({ id: 'user-2' })]);
		await expect(apiTasksRepo.listUserSummaries()).resolves.toEqual([userSummaryFixture()]);
		await expect(apiTasksRepo.createUser({ name: '新規' })).resolves.toEqual(
			userFixture({ id: 'user-3' })
		);
		await expect(
			apiTasksRepo.updateUser('user-1', {
				name: '佐藤',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toEqual(userFixture({ name: '佐藤' }));
		await expect(apiTasksRepo.removeUser('user-1')).resolves.toBeUndefined();

		expect(axiosMocks.client.get).toHaveBeenNthCalledWith(1, '/api/projects/project-1/members');
		expect(axiosMocks.client.put).toHaveBeenCalledWith('/api/projects/project-1/members', {
			userIds: ['user-1']
		});
		expect(axiosMocks.client.get).toHaveBeenNthCalledWith(2, '/api/users');
		expect(axiosMocks.client.get).toHaveBeenNthCalledWith(3, '/api/users/summary');
		expect(axiosMocks.client.post).toHaveBeenCalledWith('/api/users', { name: '新規' });
		expect(axiosMocks.client.patch).toHaveBeenCalledWith('/api/users/user-1', {
			name: '佐藤',
			updatedAt: '2026-03-01T00:00:00.000Z'
		});
		expect(axiosMocks.client.delete).toHaveBeenCalledWith('/api/users/user-1');
	});

	it('task endpoints should parse successful responses', async () => {
		axiosMocks.client.get
			.mockResolvedValueOnce({ data: [taskFixture()] })
			.mockResolvedValueOnce({ data: [taskHistoryFixture()] });
		axiosMocks.client.post
			.mockResolvedValueOnce({ data: taskFixture({ id: 'task-2' }) })
			.mockResolvedValueOnce({ data: [taskFixture({ id: 'task-2', sortOrder: 1 })] });
		axiosMocks.client.patch.mockResolvedValueOnce({ data: taskFixture({ title: '更新後' }) });
		axiosMocks.client.delete.mockResolvedValueOnce(undefined);

		await expect(apiTasksRepo.list('project-1')).resolves.toEqual([taskFixture()]);
		await expect(apiTasksRepo.listTaskHistory('project-1', 'task-1')).resolves.toEqual([
			taskHistoryFixture()
		]);
		await expect(
			apiTasksRepo.create('project-1', {
				title: '新規タスク',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-03',
				progress: 20,
				assigneeIds: [],
				predecessorTaskId: null
			})
		).resolves.toEqual(taskFixture({ id: 'task-2' }));
		await expect(
			apiTasksRepo.update('project-1', 'task-1', {
				title: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).resolves.toEqual(taskFixture({ title: '更新後' }));
		await expect(apiTasksRepo.reorder('project-1', ['task-2'])).resolves.toEqual([
			taskFixture({ id: 'task-2', sortOrder: 1 })
		]);
		await expect(apiTasksRepo.remove('project-1', 'task-1')).resolves.toBeUndefined();

		expect(axiosMocks.client.get).toHaveBeenNthCalledWith(1, '/api/tasks', {
			params: { projectId: 'project-1' }
		});
		expect(axiosMocks.client.get).toHaveBeenNthCalledWith(2, '/api/tasks/task-1/history', {
			params: { projectId: 'project-1' }
		});
		expect(axiosMocks.client.post).toHaveBeenNthCalledWith(
			1,
			'/api/tasks',
			{
				title: '新規タスク',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-03',
				progress: 20,
				assigneeIds: [],
				predecessorTaskId: null
			},
			{
				params: { projectId: 'project-1' }
			}
		);
		expect(axiosMocks.client.patch).toHaveBeenCalledWith(
			'/api/tasks/task-1',
			{
				title: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			},
			{
				params: { projectId: 'project-1' }
			}
		);
		expect(axiosMocks.client.post).toHaveBeenNthCalledWith(
			2,
			'/api/tasks/reorder',
			{ ids: ['task-2'] },
			{
				params: { projectId: 'project-1' }
			}
		);
		expect(axiosMocks.client.delete).toHaveBeenCalledWith('/api/tasks/task-1', {
			params: { projectId: 'project-1' }
		});
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

	it('listTaskHistory should reject invalid payload from API', async () => {
		axiosMocks.client.get.mockResolvedValueOnce({
			data: [
				{
					id: 'history-1',
					taskId: 'task-1'
				}
			]
		});

		await expect(apiTasksRepo.listTaskHistory('project-1', 'task-1')).rejects.toThrow(
			'APIレスポンスの形式が不正です。'
		);
	});

	it('listTaskHistory should reject non-array and primitive history payloads', async () => {
		axiosMocks.client.get
			.mockResolvedValueOnce({ data: { broken: true } })
			.mockResolvedValueOnce({ data: [null] });

		await expect(apiTasksRepo.listTaskHistory('project-1', 'task-1')).rejects.toThrow(
			'APIレスポンスの形式が不正です。'
		);
		await expect(apiTasksRepo.listTaskHistory('project-1', 'task-1')).rejects.toThrow(
			'APIレスポンスの形式が不正です。'
		);
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

	it('repo methods should keep fallback error messages for non-axios and response.error payloads', async () => {
		axiosMocks.client.delete.mockRejectedValueOnce({
			isAxiosError: true,
			response: {
				data: {
					error: 'cannot delete'
				}
			},
			message: 'Request failed'
		});
		axiosMocks.client.get.mockRejectedValueOnce(new Error('plain failure'));

		await expect(apiTasksRepo.removeProject('project-1')).rejects.toThrow('cannot delete');
		await expect(apiTasksRepo.listUsers()).rejects.toThrow('plain failure');
	});

	it('repo methods should surface axios error.message across remaining endpoints', async () => {
		const axiosMessageError = {
			isAxiosError: true,
			message: 'network boom'
		};
		axiosMocks.client.get
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError);
		axiosMocks.client.post
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError);
		axiosMocks.client.patch
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError);
		axiosMocks.client.put.mockRejectedValueOnce(axiosMessageError);
		axiosMocks.client.delete
			.mockRejectedValueOnce(axiosMessageError)
			.mockRejectedValueOnce(axiosMessageError);

		await expect(apiTasksRepo.listProjectSummaries()).rejects.toThrow('network boom');
		await expect(apiTasksRepo.listProjectMembers('project-1')).rejects.toThrow('network boom');
		await expect(apiTasksRepo.listUserSummaries()).rejects.toThrow('network boom');
		await expect(apiTasksRepo.list('project-1')).rejects.toThrow('network boom');
		await expect(apiTasksRepo.createProject({ name: 'P2' })).rejects.toThrow('network boom');
		await expect(apiTasksRepo.reorderProjects(['project-1'])).rejects.toThrow('network boom');
		await expect(apiTasksRepo.createUser({ name: 'P2 user' })).rejects.toThrow('network boom');
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
		).rejects.toThrow('network boom');
		await expect(apiTasksRepo.reorder('project-1', ['task-1'])).rejects.toThrow('network boom');
		await expect(
			apiTasksRepo.updateProject('project-1', {
				name: 'Renamed',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow('network boom');
		await expect(
			apiTasksRepo.updateUser('user-1', {
				name: 'Renamed',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow('network boom');
		await expect(
			apiTasksRepo.update('project-1', 'task-1', {
				title: 'Renamed',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).rejects.toThrow('network boom');
		await expect(apiTasksRepo.setProjectMembers('project-1', ['user-1'])).rejects.toThrow(
			'network boom'
		);
		await expect(apiTasksRepo.removeUser('user-1')).rejects.toThrow('network boom');
		await expect(apiTasksRepo.remove('project-1', 'task-1')).rejects.toThrow('network boom');
	});
});
