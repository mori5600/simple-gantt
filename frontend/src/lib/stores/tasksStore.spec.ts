import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type { Project, Task, TasksRepo, User } from '$lib/data/tasks/repo';
import { createTasksStore } from './tasksStore';

function createDeferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function projectFixture(id: string): Project {
	return {
		id,
		name: id,
		sortOrder: 0,
		updatedAt: '2026-02-20T00:00:00.000Z'
	};
}

function userFixture(id: string): User {
	return {
		id,
		name: id,
		updatedAt: '2026-02-20T00:00:00.000Z'
	};
}

function taskFixture(id: string, projectId: string, overrides: Partial<Task> = {}): Task {
	return {
		id,
		projectId,
		title: id,
		note: '',
		startDate: '2026-02-20',
		endDate: '2026-02-21',
		progress: 0,
		sortOrder: 0,
		updatedAt: '2026-02-20T00:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: null,
		...overrides
	};
}

function createRepoMock(overrides: Partial<TasksRepo> = {}): TasksRepo {
	return {
		listProjects: vi.fn().mockResolvedValue([projectFixture('project-1')]),
		listUsers: vi.fn().mockResolvedValue([userFixture('user-1')]),
		listProjectMembers: vi.fn().mockResolvedValue([userFixture('user-1')]),
		setProjectMembers: vi.fn(),
		list: vi.fn().mockResolvedValue([taskFixture('task-1', 'project-1')]),
		listTaskHistory: vi.fn().mockResolvedValue([]),
		create: vi.fn().mockResolvedValue(taskFixture('task-1', 'project-1')),
		update: vi.fn().mockResolvedValue(taskFixture('task-1', 'project-1')),
		reorder: vi.fn().mockResolvedValue([taskFixture('task-1', 'project-1')]),
		remove: vi.fn().mockResolvedValue(undefined),
		listProjectSummaries: vi.fn().mockResolvedValue([]),
		createProject: vi.fn(),
		updateProject: vi.fn(),
		reorderProjects: vi.fn(),
		removeProject: vi.fn(),
		listUserSummaries: vi.fn().mockResolvedValue([]),
		createUser: vi.fn(),
		updateUser: vi.fn(),
		removeUser: vi.fn(),
		...overrides
	};
}

describe('tasksStore', () => {
	it('load should ignore stale task results from older requests', async () => {
		const deferredA = createDeferred<Task[]>();
		const deferredB = createDeferred<Task[]>();

		const repo = {
			listProjects: vi
				.fn()
				.mockResolvedValue([projectFixture('project-a'), projectFixture('project-b')]),
			listUsers: vi.fn().mockResolvedValue([userFixture('user-1')]),
			listProjectMembers: vi.fn().mockResolvedValue([userFixture('user-1')]),
			setProjectMembers: vi.fn(),
			list: vi.fn((projectId: string) => {
				if (projectId === 'project-a') {
					return deferredA.promise;
				}
				return deferredB.promise;
			}),
			listTaskHistory: vi.fn().mockResolvedValue([]),
			create: vi.fn(),
			update: vi.fn(),
			reorder: vi.fn(),
			remove: vi.fn(),
			listProjectSummaries: vi.fn(),
			createProject: vi.fn(),
			updateProject: vi.fn(),
			reorderProjects: vi.fn(),
			removeProject: vi.fn(),
			listUserSummaries: vi.fn(),
			createUser: vi.fn(),
			updateUser: vi.fn(),
			removeUser: vi.fn()
		} satisfies TasksRepo;

		const store = createTasksStore(repo);
		let latestTaskIds: string[] = [];
		const unsubscribe = store.subscribe((tasks) => {
			latestTaskIds = tasks.map((task) => task.id);
		});

		const loadOlder = store.load('project-a');
		const loadLatest = store.load('project-b');

		deferredB.resolve([taskFixture('task-b', 'project-b')]);
		await loadLatest;

		deferredA.resolve([taskFixture('task-a', 'project-a')]);
		await loadOlder;

		expect(latestTaskIds).toEqual(['task-b']);
		unsubscribe();
	});

	it('load should populate task, project, user, and project member stores', async () => {
		const tasks = [taskFixture('task-2', 'project-1')];
		const projects = [projectFixture('project-1'), projectFixture('project-2')];
		const users = [userFixture('user-1'), userFixture('user-2')];
		const members = [userFixture('user-2')];
		const repo = createRepoMock({
			list: vi.fn().mockResolvedValue(tasks),
			listProjects: vi.fn().mockResolvedValue(projects),
			listUsers: vi.fn().mockResolvedValue(users),
			listProjectMembers: vi.fn().mockResolvedValue(members)
		});
		const store = createTasksStore(repo);

		await expect(store.load('project-1')).resolves.toEqual(tasks);

		expect(get(store)).toEqual(tasks);
		expect(get(store.projects)).toEqual(projects);
		expect(get(store.users)).toEqual(users);
		expect(get(store.projectMembers)).toEqual(members);
	});

	it('loadProjects should update the projects store', async () => {
		const projects = [projectFixture('project-2')];
		const repo = createRepoMock({
			listProjects: vi.fn().mockResolvedValue(projects)
		});
		const store = createTasksStore(repo);

		await expect(store.loadProjects()).resolves.toEqual(projects);

		expect(get(store.projects)).toEqual(projects);
		expect(get(store)).toEqual([]);
	});

	it('refresh should update tasks and project members without overwriting users or projects', async () => {
		const initialProjects = [projectFixture('project-1')];
		const initialUsers = [userFixture('user-1')];
		const refreshedTasks = [taskFixture('task-9', 'project-1')];
		const refreshedMembers = [userFixture('user-2')];
		const repo = createRepoMock({
			listProjects: vi.fn().mockResolvedValue(initialProjects),
			listUsers: vi.fn().mockResolvedValue(initialUsers),
			list: vi
				.fn()
				.mockResolvedValueOnce([taskFixture('task-1', 'project-1')])
				.mockResolvedValueOnce(refreshedTasks),
			listProjectMembers: vi
				.fn()
				.mockResolvedValueOnce([userFixture('user-1')])
				.mockResolvedValueOnce(refreshedMembers)
		});
		const store = createTasksStore(repo);

		await store.load('project-1');
		await expect(store.refresh('project-1')).resolves.toEqual(refreshedTasks);

		expect(get(store)).toEqual(refreshedTasks);
		expect(get(store.projects)).toEqual(initialProjects);
		expect(get(store.users)).toEqual(initialUsers);
		expect(get(store.projectMembers)).toEqual(refreshedMembers);
	});

	it('refresh should ignore stale results and detect assignee array changes', async () => {
		const deferredA = createDeferred<Task[]>();
		const deferredB = createDeferred<Task[]>();
		const nextProjectCTasks = [
			[taskFixture('task-b', 'project-b', { assigneeIds: ['user-1'] })],
			[
				taskFixture('task-b', 'project-b', {
					assigneeIds: ['user-1', 'user-2']
				})
			],
			[
				taskFixture('task-b', 'project-b', {
					assigneeIds: ['user-2', 'user-3']
				})
			]
		];
		const repo = createRepoMock({
			list: vi.fn((projectId: string) => {
				if (projectId === 'project-a') {
					return deferredA.promise;
				}
				if (projectId === 'project-b') {
					return deferredB.promise;
				}
				return Promise.resolve(nextProjectCTasks.shift() ?? []);
			}),
			listProjectMembers: vi.fn().mockResolvedValue([userFixture('user-1')])
		});
		const store = createTasksStore(repo);
		let latestTaskIds: string[] = [];
		const unsubscribe = store.subscribe((tasks) => {
			latestTaskIds = tasks.map((task) => task.id);
		});

		const olderRefresh = store.refresh('project-a');
		const latestRefresh = store.refresh('project-b');

		deferredB.resolve([taskFixture('task-b', 'project-b')]);
		await latestRefresh;

		deferredA.resolve([taskFixture('task-a', 'project-a')]);
		await olderRefresh;

		expect(latestTaskIds).toEqual(['task-b']);

		await store.refresh('project-c');
		expect(get(store)[0]?.assigneeIds).toEqual(['user-1']);

		await store.refresh('project-c');
		expect(get(store)[0]?.assigneeIds).toEqual(['user-1', 'user-2']);

		await store.refresh('project-c');
		expect(get(store)[0]?.assigneeIds).toEqual(['user-2', 'user-3']);

		unsubscribe();
	});

	it('create, update, and remove should reload project tasks', async () => {
		const createdTask = taskFixture('task-2', 'project-1');
		const updatedTask = {
			...createdTask,
			title: '更新済み',
			updatedAt: '2026-03-02T00:00:00.000Z'
		};
		const repo = createRepoMock({
			list: vi
				.fn()
				.mockResolvedValueOnce([taskFixture('task-1', 'project-1')])
				.mockResolvedValueOnce([createdTask])
				.mockResolvedValueOnce([updatedTask])
				.mockResolvedValueOnce([]),
			create: vi.fn().mockResolvedValue(createdTask),
			update: vi.fn().mockResolvedValue(updatedTask),
			remove: vi.fn().mockResolvedValue(undefined)
		});
		const store = createTasksStore(repo);
		const createInput = {
			title: createdTask.title,
			note: createdTask.note,
			startDate: createdTask.startDate,
			endDate: createdTask.endDate,
			progress: createdTask.progress,
			assigneeIds: createdTask.assigneeIds,
			predecessorTaskId: createdTask.predecessorTaskId
		};
		const updateInput = {
			...createInput,
			updatedAt: createdTask.updatedAt,
			title: updatedTask.title
		};

		await store.load('project-1');
		await expect(store.create('project-1', createInput)).resolves.toEqual(createdTask);
		expect(get(store)).toEqual([createdTask]);

		await expect(store.update('project-1', createdTask.id, updateInput)).resolves.toEqual(
			updatedTask
		);
		expect(get(store)).toEqual([updatedTask]);

		await expect(store.remove('project-1', createdTask.id)).resolves.toBeUndefined();
		expect(get(store)).toEqual([]);
	});

	it('reorder should update the task store without triggering a full reload', async () => {
		const reordered = [taskFixture('task-2', 'project-1'), taskFixture('task-1', 'project-1')];
		const repo = createRepoMock({
			reorder: vi.fn().mockResolvedValue(reordered)
		});
		const store = createTasksStore(repo);

		await expect(store.reorder('project-1', ['task-2', 'task-1'])).resolves.toEqual(reordered);

		expect(get(store)).toEqual(reordered);
		expect(repo.list).not.toHaveBeenCalled();
	});

	it('loadProjects should replace project state when metadata changes', async () => {
		const repo = createRepoMock({
			listProjects: vi
				.fn()
				.mockResolvedValueOnce([projectFixture('project-1')])
				.mockResolvedValueOnce([
					{
						...projectFixture('project-1'),
						name: 'project-1 updated',
						updatedAt: '2026-02-21T00:00:00.000Z'
					}
				])
		});
		const store = createTasksStore(repo);

		await store.loadProjects();
		await store.loadProjects();

		expect(get(store.projects)).toEqual([
			{
				...projectFixture('project-1'),
				name: 'project-1 updated',
				updatedAt: '2026-02-21T00:00:00.000Z'
			}
		]);
	});
});
