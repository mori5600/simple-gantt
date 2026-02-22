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

export function createTasksStore(repo: TasksRepo = tasksRepo) {
	const { subscribe, set } = writable<Task[]>([]);
	const projectsState = writable<Project[]>([]);
	const usersState = writable<User[]>([]);
	let latestLoadRequestId = 0;

	async function loadProjects(): Promise<Project[]> {
		const projects = await repo.listProjects();
		projectsState.set(projects);
		return projects;
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
		set(tasks);
		projectsState.set(projects);
		usersState.set(users);
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
			set(reordered);
			return reordered;
		}
	};
}

export const tasksStore = createTasksStore();
