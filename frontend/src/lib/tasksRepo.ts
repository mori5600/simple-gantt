import { apiTasksRepo } from '$lib/tasksRepoApi';
import { normalizeClientEnvValue, readClientEnv } from '$lib/env';
import {
	localTasksRepo,
	LOCAL_PROJECTS,
	LOCAL_USERS,
	resetLocalTaskCacheForTest
} from '$lib/tasksRepoLocal';
import type {
	CreateProjectInput,
	CreateTaskInput,
	CreateUserInput,
	Project,
	ProjectSummary,
	ReorderProjectsInput,
	Task,
	UpdateProjectInput,
	UpdateTaskInput,
	UpdateUserInput,
	User,
	UserSummary
} from '@simple-gantt/shared/tasks';

export type {
	CreateProjectInput,
	CreateTaskInput,
	CreateUserInput,
	Project,
	ProjectSummary,
	ReorderProjectsInput,
	Task,
	UpdateProjectInput,
	UpdateTaskInput,
	UpdateUserInput,
	User,
	UserSummary
};

export type TasksRepo = {
	listProjects: () => Promise<Project[]>;
	listProjectSummaries: () => Promise<ProjectSummary[]>;
	createProject: (input: CreateProjectInput) => Promise<Project>;
	updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>;
	reorderProjects: (ids: ReorderProjectsInput['ids']) => Promise<Project[]>;
	removeProject: (id: string) => Promise<void>;
	listUsers: () => Promise<User[]>;
	listUserSummaries: () => Promise<UserSummary[]>;
	createUser: (input: CreateUserInput) => Promise<User>;
	updateUser: (id: string, input: UpdateUserInput) => Promise<User>;
	removeUser: (id: string) => Promise<void>;
	list: (projectId: string) => Promise<Task[]>;
	create: (projectId: string, input: CreateTaskInput) => Promise<Task>;
	update: (projectId: string, id: string, input: UpdateTaskInput) => Promise<Task>;
	reorder: (projectId: string, ids: string[]) => Promise<Task[]>;
	remove: (projectId: string, id: string) => Promise<void>;
};

export type TasksRepoMode = 'local' | 'api';

function resolveRepoMode(): TasksRepoMode {
	const configured = normalizeClientEnvValue(
		readClientEnv('VITE_TASKS_DATA_SOURCE', 'PUBLIC_TASKS_DATA_SOURCE'),
		{ lowerCase: true }
	);
	return configured === 'api' ? 'api' : 'local';
}

export function createTasksRepo(mode: TasksRepoMode = resolveRepoMode()): TasksRepo {
	if (mode === 'api') {
		return apiTasksRepo;
	}
	return localTasksRepo;
}

export const tasksRepoMode = resolveRepoMode();
export const tasksRepo = createTasksRepo(tasksRepoMode);

export const DEMO_PROJECTS: readonly Project[] = LOCAL_PROJECTS;
export const DEMO_USERS: readonly User[] = LOCAL_USERS;

export function resetTaskCacheForTest(): void {
	resetLocalTaskCacheForTest();
}
