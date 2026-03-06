import { describe, expect, it } from 'vitest';
import type { Task, User } from '$lib/data/tasks/repo';
import { LIST_COLUMN_DEFAULT_WIDTHS, computeAutoColumnWidths } from './listColumns';
import { createGanttPageEffects, type GanttPageEffectsSnapshot } from './pageEffects';

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
		startDate: '2026-03-01',
		endDate: '2026-03-03',
		progress: 0,
		sortOrder: 0,
		updatedAt: '2026-03-01T00:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: null,
		...partial
	};
}

function userFixture(partial: Partial<User> = {}): User {
	return {
		id: 'user-1',
		name: '伊藤',
		updatedAt: '2026-03-01T00:00:00.000Z',
		...partial
	};
}

function createSnapshot(
	overrides: Partial<GanttPageEffectsSnapshot> = {}
): GanttPageEffectsSnapshot {
	return {
		visibleTasks: [taskFixture()],
		selectedTaskId: null,
		isListColumnAuto: false,
		orderedTasks: [taskFixture()],
		projectMembers: [userFixture()],
		taskFilters: {
			query: '',
			assignee: '',
			status: 'all',
			rangeStart: '',
			rangeEnd: ''
		},
		hasActiveFilters: false,
		isFilterStorageReady: false,
		isProjectStorageReady: false,
		selectedProjectId: '',
		taskDatePreviews: {},
		...overrides
	};
}

describe('pageEffects', () => {
	it('syncSelectedTask should replace missing selected task with first visible task', () => {
		let snapshot = createSnapshot({
			visibleTasks: [taskFixture({ id: 'task-10' }), taskFixture({ id: 'task-20' })],
			selectedTaskId: 'task-999'
		});
		const storage = new MemoryStorage();
		const effects = createGanttPageEffects({
			state: {
				read: () => snapshot,
				setSelectedTaskId: (taskId) => {
					snapshot = { ...snapshot, selectedTaskId: taskId };
				},
				setListColumnWidths: () => {},
				setTaskFilters: () => {},
				setTaskDatePreviews: () => {}
			},
			storage: {
				getStorage: () => storage,
				filtersStorageKey: 'filters',
				projectStorageKey: 'project'
			}
		});

		effects.syncSelectedTask();

		expect(snapshot.selectedTaskId).toBe('task-10');
	});

	it('syncAutoListColumns should recompute widths only when auto mode is enabled', () => {
		const snapshot = createSnapshot({
			isListColumnAuto: true,
			orderedTasks: [taskFixture({ title: 'かなり長いタイトルのタスクです' })],
			projectMembers: [userFixture({ name: '長い担当者名です' })]
		});
		let actualWidths = [...LIST_COLUMN_DEFAULT_WIDTHS];
		const storage = new MemoryStorage();
		const effects = createGanttPageEffects({
			state: {
				read: () => snapshot,
				setSelectedTaskId: () => {},
				setListColumnWidths: (widths) => {
					actualWidths = widths;
				},
				setTaskFilters: () => {},
				setTaskDatePreviews: () => {}
			},
			storage: {
				getStorage: () => storage,
				filtersStorageKey: 'filters',
				projectStorageKey: 'project'
			}
		});

		effects.syncAutoListColumns();

		expect(actualWidths).toEqual(
			computeAutoColumnWidths(snapshot.orderedTasks, snapshot.projectMembers)
		);
	});

	it('persistTaskFilters and persistSelectedProject should write storage only when ready', () => {
		let snapshot = createSnapshot({
			taskFilters: {
				query: '要件',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			},
			hasActiveFilters: true,
			isFilterStorageReady: true,
			isProjectStorageReady: true,
			selectedProjectId: 'project-1'
		});
		const storage = new MemoryStorage();
		const effects = createGanttPageEffects({
			state: {
				read: () => snapshot,
				setSelectedTaskId: () => {},
				setListColumnWidths: () => {},
				setTaskFilters: () => {},
				setTaskDatePreviews: () => {}
			},
			storage: {
				getStorage: () => storage,
				filtersStorageKey: 'filters',
				projectStorageKey: 'project'
			}
		});

		effects.persistTaskFilters();
		effects.persistSelectedProject();

		expect(storage.getItem('filters')).toContain('要件');
		expect(storage.getItem('project')).toBe('project-1');

		snapshot = createSnapshot({
			isFilterStorageReady: false,
			isProjectStorageReady: false
		});
		effects.persistTaskFilters();
		effects.persistSelectedProject();
		expect(storage.getItem('filters')).toContain('要件');
		expect(storage.getItem('project')).toBe('project-1');
	});

	it('sanitizeAssigneeFilter should clear assignee when user is not a project member', () => {
		let snapshot = createSnapshot({
			taskFilters: {
				query: '',
				assignee: 'user-missing',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			},
			projectMembers: [userFixture({ id: 'user-1' })]
		});
		const storage = new MemoryStorage();
		const effects = createGanttPageEffects({
			state: {
				read: () => snapshot,
				setSelectedTaskId: () => {},
				setListColumnWidths: () => {},
				setTaskFilters: (filters) => {
					snapshot = { ...snapshot, taskFilters: filters };
				},
				setTaskDatePreviews: () => {}
			},
			storage: {
				getStorage: () => storage,
				filtersStorageKey: 'filters',
				projectStorageKey: 'project'
			}
		});

		effects.sanitizeAssigneeFilter();

		expect(snapshot.taskFilters.assignee).toBe('');
	});

	it('trimTaskDatePreviews should remove previews for tasks that are no longer visible', () => {
		let snapshot = createSnapshot({
			visibleTasks: [taskFixture({ id: 'task-1' })],
			taskDatePreviews: {
				'task-1': {
					startDate: '2026-03-10',
					endDate: '2026-03-11'
				},
				'task-2': {
					startDate: '2026-03-12',
					endDate: '2026-03-13'
				}
			}
		});
		const storage = new MemoryStorage();
		const effects = createGanttPageEffects({
			state: {
				read: () => snapshot,
				setSelectedTaskId: () => {},
				setListColumnWidths: () => {},
				setTaskFilters: () => {},
				setTaskDatePreviews: (previews) => {
					snapshot = { ...snapshot, taskDatePreviews: previews };
				}
			},
			storage: {
				getStorage: () => storage,
				filtersStorageKey: 'filters',
				projectStorageKey: 'project'
			}
		});

		effects.trimTaskDatePreviews();

		expect(snapshot.taskDatePreviews).toEqual({
			'task-1': {
				startDate: '2026-03-10',
				endDate: '2026-03-11'
			}
		});
	});
});
