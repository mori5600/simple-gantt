import { describe, expect, it, vi } from 'vitest';
import type { Project, Task, TasksRepo, User } from '$lib/tasksRepo';
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

function taskFixture(id: string, projectId: string): Task {
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
		predecessorTaskId: null
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
			list: vi.fn((projectId: string) => {
				if (projectId === 'project-a') {
					return deferredA.promise;
				}
				return deferredB.promise;
			}),
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
});
