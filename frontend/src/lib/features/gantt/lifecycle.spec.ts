import { afterEach, describe, expect, it, vi } from 'vitest';
import { POLLING_SETTINGS_STORAGE_KEY } from '$lib/shared/pollingSettings';
import type { Task } from '$lib/data/tasks/repo';
import {
	createGanttSyncPolling,
	initializeGanttProject,
	mountGanttPageLifecycle,
	persistSelectedProject,
	persistTaskFilters,
	restorePersistedGanttState,
	subscribeToGanttStore,
	type GanttStoreSubscriptions
} from './lifecycle';

class MemoryStorage implements Storage {
	private readonly store = new Map<string, string>();

	get length(): number {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.store.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}
}

function taskFixture(partial: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		projectId: 'project-1',
		title: '設計',
		note: '',
		startDate: '2026-02-20',
		endDate: '2026-02-21',
		progress: 0,
		sortOrder: 0,
		updatedAt: '2026-02-20T00:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: null,
		...partial
	};
}

function createReadable<T>(initial: T) {
	let currentListener: ((value: T) => void) | null = null;
	const unsubscribe = vi.fn();

	return {
		readable: {
			subscribe(run: (value: T) => void): () => void {
				currentListener = run;
				run(initial);
				return unsubscribe;
			}
		},
		emit(value: T): void {
			currentListener?.(value);
		},
		unsubscribe
	};
}

describe('gantt lifecycle helpers', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('restorePersistedGanttState should read stored filters and project id', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			'simple-gantt:task-filters:v1',
			JSON.stringify({
				query: '要件',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			})
		);
		storage.setItem('simple-gantt:selected-project:v1', 'project-1');

		const result = restorePersistedGanttState({
			storage,
			filtersStorageKey: 'simple-gantt:task-filters:v1',
			projectStorageKey: 'simple-gantt:selected-project:v1'
		});

		expect(result).toEqual({
			filters: {
				query: '要件',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			},
			projectId: 'project-1'
		});
	});

	it('persistTaskFilters and persistSelectedProject should respect storage readiness', () => {
		const storage = new MemoryStorage();

		persistTaskFilters({
			storage,
			isStorageReady: false,
			storageKey: 'filters',
			filters: {
				query: '要件',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			},
			hasActiveFilters: true
		});
		persistSelectedProject({
			storage,
			isStorageReady: false,
			storageKey: 'project',
			projectId: 'project-1'
		});

		expect(storage.getItem('filters')).toBeNull();
		expect(storage.getItem('project')).toBeNull();

		persistTaskFilters({
			storage,
			isStorageReady: true,
			storageKey: 'filters',
			filters: {
				query: '要件',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			},
			hasActiveFilters: true
		});
		persistSelectedProject({
			storage,
			isStorageReady: true,
			storageKey: 'project',
			projectId: 'project-1'
		});

		expect(storage.getItem('filters')).toContain('要件');
		expect(storage.getItem('project')).toBe('project-1');

		persistTaskFilters({
			storage,
			isStorageReady: true,
			storageKey: 'filters',
			filters: {
				query: '',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			},
			hasActiveFilters: false
		});
		persistSelectedProject({
			storage,
			isStorageReady: true,
			storageKey: 'project',
			projectId: ''
		});

		expect(storage.getItem('filters')).toBeNull();
		expect(storage.getItem('project')).toBeNull();
	});

	it('subscribeToGanttStore should subscribe all channels and return unified cleanup', () => {
		const tasks = createReadable<Task[]>([taskFixture()]);
		const projects = createReadable([{ id: 'project-1', name: 'A', sortOrder: 0, updatedAt: 'x' }]);
		const users = createReadable([{ id: 'user-1', name: '伊藤', updatedAt: 'x' }]);
		const members = createReadable([{ id: 'user-2', name: '佐藤', updatedAt: 'x' }]);
		const onTasks = vi.fn();
		const onProjects = vi.fn();
		const onUsers = vi.fn();
		const onProjectMembers = vi.fn();

		const store: GanttStoreSubscriptions = {
			subscribe: tasks.readable.subscribe,
			projects: projects.readable,
			users: users.readable,
			projectMembers: members.readable
		};

		const unsubscribe = subscribeToGanttStore({
			store,
			onTasks,
			onProjects,
			onUsers,
			onProjectMembers
		});

		expect(onTasks).toHaveBeenCalledTimes(1);
		expect(onProjects).toHaveBeenCalledTimes(1);
		expect(onUsers).toHaveBeenCalledTimes(1);
		expect(onProjectMembers).toHaveBeenCalledTimes(1);

		unsubscribe();

		expect(tasks.unsubscribe).toHaveBeenCalledTimes(1);
		expect(projects.unsubscribe).toHaveBeenCalledTimes(1);
		expect(users.unsubscribe).toHaveBeenCalledTimes(1);
		expect(members.unsubscribe).toHaveBeenCalledTimes(1);
	});

	it('createGanttSyncPolling should return null when gantt polling is disabled in settings', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			POLLING_SETTINGS_STORAGE_KEY,
			JSON.stringify({
				ganttIntervalMs: null
			})
		);

		const polling = createGanttSyncPolling({
			defaultIntervalMs: 15_000,
			storage,
			isEnabled: () => true,
			onPoll: vi.fn(),
			onError: vi.fn()
		});

		expect(polling).toBeNull();
	});

	it('createGanttSyncPolling should create controller when polling is enabled', () => {
		const polling = createGanttSyncPolling({
			defaultIntervalMs: 15_000,
			storage: undefined,
			isEnabled: () => false,
			onPoll: vi.fn(),
			onError: vi.fn()
		});

		expect(polling).not.toBeNull();
		polling?.stop();
	});

	it('initializeGanttProject should delegate to initial project action', async () => {
		const store = {
			loadProjects: vi
				.fn()
				.mockResolvedValue([{ id: 'project-1', name: 'A', sortOrder: 0, updatedAt: 'x' }]),
			load: vi.fn().mockResolvedValue([])
		};

		const result = await initializeGanttProject({
			store,
			storedProjectId: 'project-1'
		});

		expect(result).toEqual({
			kind: 'ok',
			projectId: 'project-1'
		});
		expect(store.load).toHaveBeenCalledWith('project-1');
	});

	it('mountGanttPageLifecycle should restore state, initialize project, and cleanup subscriptions', async () => {
		const storage = new MemoryStorage();
		storage.setItem(
			'simple-gantt:task-filters:v1',
			JSON.stringify({
				query: '復元',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			})
		);
		storage.setItem('simple-gantt:selected-project:v1', 'project-1');
		vi.stubGlobal('localStorage', storage);

		const tasks = createReadable<Task[]>([taskFixture()]);
		const projects = createReadable([{ id: 'project-1', name: 'A', sortOrder: 0, updatedAt: 'x' }]);
		const users = createReadable([{ id: 'user-1', name: '伊藤', updatedAt: 'x' }]);
		const members = createReadable([{ id: 'user-2', name: '佐藤', updatedAt: 'x' }]);
		const refreshProject = vi.fn().mockResolvedValue(undefined);
		const onTaskFiltersRestored = vi.fn();
		const onStorageReady = vi.fn();
		const onInitializeSuccess = vi.fn();

		const unmount = mountGanttPageLifecycle({
			store: {
				subscribe: tasks.readable.subscribe,
				projects: projects.readable,
				users: users.readable,
				projectMembers: members.readable,
				loadProjects: vi.fn().mockResolvedValue([
					{ id: 'project-1', name: 'A', sortOrder: 0, updatedAt: 'x' }
				]),
				load: vi.fn().mockResolvedValue([])
			},
			refreshProject,
			filtersStorageKey: 'simple-gantt:task-filters:v1',
			projectStorageKey: 'simple-gantt:selected-project:v1',
			defaultSyncPollIntervalMs: 15_000,
			getSyncState: () => ({
				selectedProjectId: 'project-1',
				isSubmitting: false,
				isInitialized: true
			}),
			onTaskFiltersRestored,
			onStorageReady,
			onTasks: vi.fn(),
			onProjects: vi.fn(),
			onUsers: vi.fn(),
			onProjectMembers: vi.fn(),
			onSyncError: vi.fn(),
			onInitializeSuccess,
			onInitializeError: vi.fn()
		});

		await vi.waitFor(() => {
			expect(onInitializeSuccess).toHaveBeenCalledWith('project-1');
		});
		expect(onTaskFiltersRestored).toHaveBeenCalledWith({
			query: '復元',
			assignee: '',
			status: 'all',
			rangeStart: '',
			rangeEnd: ''
		});
		expect(onStorageReady).toHaveBeenCalledTimes(1);

		unmount();
		expect(tasks.unsubscribe).toHaveBeenCalledTimes(1);
		expect(projects.unsubscribe).toHaveBeenCalledTimes(1);
		expect(users.unsubscribe).toHaveBeenCalledTimes(1);
		expect(members.unsubscribe).toHaveBeenCalledTimes(1);
		expect(refreshProject).not.toHaveBeenCalled();
	});
});
