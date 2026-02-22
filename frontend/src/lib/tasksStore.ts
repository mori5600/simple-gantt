import { writable } from 'svelte/store';
import type { Readable } from 'svelte/store';
import {
	type Project,
	type TasksRepo,
	tasksRepo,
	type CreateTaskInput,
	type Task,
	type UpdateTaskInput,
	type User
} from '$lib/tasksRepo';

function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}

function areProjectsEqual(left: readonly Project[], right: readonly Project[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index += 1) {
		const a = left[index];
		const b = right[index];
		if (
			a.id !== b.id ||
			a.name !== b.name ||
			a.sortOrder !== b.sortOrder ||
			a.updatedAt !== b.updatedAt
		) {
			return false;
		}
	}
	return true;
}

function areUsersEqual(left: readonly User[], right: readonly User[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index += 1) {
		const a = left[index];
		const b = right[index];
		if (a.id !== b.id || a.name !== b.name || a.updatedAt !== b.updatedAt) {
			return false;
		}
	}
	return true;
}

function areTasksEqual(left: readonly Task[], right: readonly Task[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index += 1) {
		const a = left[index];
		const b = right[index];
		if (
			a.id !== b.id ||
			a.projectId !== b.projectId ||
			a.title !== b.title ||
			a.note !== b.note ||
			a.startDate !== b.startDate ||
			a.endDate !== b.endDate ||
			a.progress !== b.progress ||
			a.sortOrder !== b.sortOrder ||
			a.updatedAt !== b.updatedAt ||
			a.predecessorTaskId !== b.predecessorTaskId ||
			!areStringArraysEqual(a.assigneeIds, b.assigneeIds)
		) {
			return false;
		}
	}
	return true;
}

export function createTasksStore(repo: TasksRepo = tasksRepo) {
	const { subscribe, set } = writable<Task[]>([]);
	const projectsState = writable<Project[]>([]);
	const usersState = writable<User[]>([]);
	let latestLoadRequestId = 0;
	let currentTasks: Task[] = [];
	let currentProjects: Project[] = [];
	let currentUsers: User[] = [];

	function updateTasks(nextTasks: Task[]): void {
		if (areTasksEqual(currentTasks, nextTasks)) {
			return;
		}
		currentTasks = nextTasks;
		set(nextTasks);
	}

	function updateProjects(nextProjects: Project[]): void {
		if (areProjectsEqual(currentProjects, nextProjects)) {
			return;
		}
		currentProjects = nextProjects;
		projectsState.set(nextProjects);
	}

	function updateUsers(nextUsers: User[]): void {
		if (areUsersEqual(currentUsers, nextUsers)) {
			return;
		}
		currentUsers = nextUsers;
		usersState.set(nextUsers);
	}

	async function loadProjects(): Promise<Project[]> {
		const projects = await repo.listProjects();
		updateProjects(projects);
		return projects;
	}

	async function refresh(projectId: string): Promise<Task[]> {
		const requestId = ++latestLoadRequestId;
		const tasks = await repo.list(projectId);
		if (requestId !== latestLoadRequestId) {
			return tasks;
		}
		updateTasks(tasks);
		return tasks;
	}

	async function load(projectId: string): Promise<Task[]> {
		const requestId = ++latestLoadRequestId;
		const [tasks, users, projects] = await Promise.all([
			repo.list(projectId),
			repo.listUsers(),
			repo.listProjects()
		]);
		if (requestId !== latestLoadRequestId) {
			return tasks;
		}
		updateTasks(tasks);
		updateProjects(projects);
		updateUsers(users);
		return tasks;
	}

	return {
		subscribe,
		projects: {
			subscribe: projectsState.subscribe
		} satisfies Readable<Project[]>,
		users: {
			subscribe: usersState.subscribe
		} satisfies Readable<User[]>,
		loadProjects,
		refresh,
		load,
		async create(projectId: string, input: CreateTaskInput): Promise<Task> {
			const created = await repo.create(projectId, input);
			await load(projectId);
			return created;
		},
		async update(projectId: string, id: string, input: UpdateTaskInput): Promise<Task> {
			const updated = await repo.update(projectId, id, input);
			await load(projectId);
			return updated;
		},
		async remove(projectId: string, id: string): Promise<void> {
			await repo.remove(projectId, id);
			await load(projectId);
		},
		async reorder(projectId: string, ids: string[]): Promise<Task[]> {
			const reordered = await repo.reorder(projectId, ids);
			updateTasks(reordered);
			return reordered;
		}
	};
}

export const tasksStore = createTasksStore();
