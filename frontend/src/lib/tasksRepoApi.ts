import axios from 'axios';
import {
	projectSchema,
	projectSummarySchema,
	taskSchema,
	userSchema,
	userSummarySchema
} from '@simple-gantt/shared/tasks';
import type {
	CreateUserInput,
	CreateTaskInput,
	Project,
	ProjectSummary,
	Task,
	TaskHistoryEntry,
	TasksRepo,
	UpdateUserInput,
	UpdateTaskInput,
	User,
	UserSummary
} from '$lib/tasksRepo';
import { normalizeClientEnvValue, readClientEnv } from '$lib/env';

const apiBaseUrl = normalizeClientEnvValue(
	readClientEnv('VITE_API_BASE_URL', 'PUBLIC_API_BASE_URL') ?? 'http://localhost:8787'
).replace(/\/$/, '');

const apiClient = axios.create({
	baseURL: apiBaseUrl,
	timeout: 10_000,
	headers: {
		'Content-Type': 'application/json'
	}
});

const projectsSchema = projectSchema.array();
const projectSummariesSchema = projectSummarySchema.array();
const usersSchema = userSchema.array();
const userSummariesSchema = userSummarySchema.array();
const tasksSchema = taskSchema.array();

function isIsoDate(value: unknown): value is string {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoDateTime(value: unknown): value is string {
	return typeof value === 'string' && value.includes('T') && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

const taskHistorySchema = {
	safeParse(data: unknown): { success: true; data: TaskHistoryEntry[] } | { success: false } {
		if (!Array.isArray(data)) {
			return { success: false };
		}

		const parsed: TaskHistoryEntry[] = [];
		for (const item of data) {
			if (!item || typeof item !== 'object') {
				return { success: false };
			}

			const entry = item as Record<string, unknown>;
			if (
				!isNonEmptyString(entry.id) ||
				!isNonEmptyString(entry.taskId) ||
				!isNonEmptyString(entry.projectId) ||
				(entry.action !== 'created' && entry.action !== 'updated' && entry.action !== 'deleted') ||
				!Array.isArray(entry.changedFields) ||
				!entry.changedFields.every((field) => isNonEmptyString(field)) ||
				!isNonEmptyString(entry.title) ||
				typeof entry.note !== 'string' ||
				!isIsoDate(entry.startDate) ||
				!isIsoDate(entry.endDate) ||
				typeof entry.progress !== 'number' ||
				!Number.isInteger(entry.progress) ||
				entry.progress < 0 ||
				entry.progress > 100 ||
				!Array.isArray(entry.assigneeIds) ||
				!entry.assigneeIds.every((id) => isNonEmptyString(id)) ||
				!(entry.predecessorTaskId === null || isNonEmptyString(entry.predecessorTaskId)) ||
				!isIsoDateTime(entry.createdAt)
			) {
				return { success: false };
			}

			parsed.push({
				id: entry.id,
				taskId: entry.taskId,
				projectId: entry.projectId,
				action: entry.action,
				changedFields: [...entry.changedFields],
				title: entry.title,
				note: entry.note,
				startDate: entry.startDate,
				endDate: entry.endDate,
				progress: entry.progress,
				assigneeIds: [...entry.assigneeIds],
				predecessorTaskId: entry.predecessorTaskId,
				createdAt: entry.createdAt
			});
		}

		return { success: true, data: parsed };
	}
};

function toErrorMessage(error: unknown): string {
	if (axios.isAxiosError(error)) {
		const responseData = error.response?.data as { error?: string; message?: string } | undefined;
		return (
			responseData?.message ??
			responseData?.error ??
			error.message ??
			'バックエンドAPIへのリクエストに失敗しました。'
		);
	}
	return error instanceof Error ? error.message : 'バックエンドAPIへのリクエストに失敗しました。';
}

function parseApiResponse<T>(
	parser: { safeParse: (data: unknown) => { success: true; data: T } | { success: false } },
	data: unknown
): T {
	const parsed = parser.safeParse(data);
	if (!parsed.success) {
		throw new Error('APIレスポンスの形式が不正です。');
	}
	return parsed.data;
}

export const apiTasksRepo: TasksRepo = {
	async listProjects(): Promise<Project[]> {
		try {
			const response = await apiClient.get('/api/projects');
			return parseApiResponse(projectsSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async listProjectSummaries(): Promise<ProjectSummary[]> {
		try {
			const response = await apiClient.get('/api/projects/summary');
			return parseApiResponse(projectSummariesSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async createProject(input) {
		try {
			const response = await apiClient.post('/api/projects', input);
			return parseApiResponse(projectSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async updateProject(id, input) {
		try {
			const response = await apiClient.patch(`/api/projects/${id}`, input);
			return parseApiResponse(projectSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async reorderProjects(ids) {
		try {
			const response = await apiClient.post('/api/projects/reorder', { ids });
			return parseApiResponse(projectsSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async removeProject(id) {
		try {
			await apiClient.delete(`/api/projects/${id}`);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async listUsers(): Promise<User[]> {
		try {
			const response = await apiClient.get('/api/users');
			return parseApiResponse(usersSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async listUserSummaries(): Promise<UserSummary[]> {
		try {
			const response = await apiClient.get('/api/users/summary');
			return parseApiResponse(userSummariesSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async createUser(input: CreateUserInput): Promise<User> {
		try {
			const response = await apiClient.post('/api/users', input);
			return parseApiResponse(userSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async updateUser(id: string, input: UpdateUserInput): Promise<User> {
		try {
			const response = await apiClient.patch(`/api/users/${id}`, input);
			return parseApiResponse(userSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async removeUser(id: string): Promise<void> {
		try {
			await apiClient.delete(`/api/users/${id}`);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async list(projectId: string): Promise<Task[]> {
		try {
			const response = await apiClient.get('/api/tasks', {
				params: {
					projectId
				}
			});
			return parseApiResponse(tasksSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async listTaskHistory(projectId: string, taskId: string) {
		try {
			const response = await apiClient.get(`/api/tasks/${taskId}/history`, {
				params: {
					projectId
				}
			});
			return parseApiResponse(taskHistorySchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async create(projectId: string, input: CreateTaskInput): Promise<Task> {
		try {
			const response = await apiClient.post('/api/tasks', input, {
				params: {
					projectId
				}
			});
			return parseApiResponse(taskSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async update(projectId: string, id: string, input: UpdateTaskInput): Promise<Task> {
		try {
			const response = await apiClient.patch(`/api/tasks/${id}`, input, {
				params: {
					projectId
				}
			});
			return parseApiResponse(taskSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async reorder(projectId: string, ids: string[]): Promise<Task[]> {
		try {
			const response = await apiClient.post(
				'/api/tasks/reorder',
				{ ids },
				{
					params: {
						projectId
					}
				}
			);
			return parseApiResponse(tasksSchema, response.data);
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	},

	async remove(projectId: string, id: string): Promise<void> {
		try {
			await apiClient.delete(`/api/tasks/${id}`, {
				params: {
					projectId
				}
			});
		} catch (error) {
			throw new Error(toErrorMessage(error));
		}
	}
};
