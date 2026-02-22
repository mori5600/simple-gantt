import { describe, expect, it } from 'vitest';
import type { Task } from '$lib/tasksRepo';
import {
	ensureSelectedTaskId,
	filterTasksByFilters,
	hasActiveTaskFilters,
	hasDependencyViolation,
	indexTasksById,
	orderTasksForDisplay,
	reorderTaskIds,
	trimTaskDatePreviews
} from './state';

function taskFixture(partial: Partial<Task>): Task {
	return {
		id: 'task-1',
		projectId: 'project-1',
		title: '設計',
		note: '',
		startDate: '2026-02-20',
		endDate: '2026-02-21',
		progress: 10,
		sortOrder: 0,
		updatedAt: '2026-02-20T00:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: null,
		...partial
	};
}

describe('gantt state helpers', () => {
	it('hasActiveTaskFilters should detect active values', () => {
		expect(
			hasActiveTaskFilters({
				query: '',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			})
		).toBe(false);
		expect(
			hasActiveTaskFilters({
				query: '設計',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			})
		).toBe(true);
	});

	it('filterTasksByFilters should apply query, status, assignee, and range', () => {
		const tasks = [
			taskFixture({
				id: 'task-1',
				title: '要件確認',
				progress: 100,
				assigneeIds: ['user-1'],
				startDate: '2026-02-20',
				endDate: '2026-02-21'
			}),
			taskFixture({
				id: 'task-2',
				title: 'UI実装',
				progress: 20,
				assigneeIds: [],
				startDate: '2026-02-25',
				endDate: '2026-02-26'
			})
		];

		expect(
			filterTasksByFilters(tasks, {
				query: 'UI',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			}).map((task) => task.id)
		).toEqual(['task-2']);

		expect(
			filterTasksByFilters(tasks, {
				query: '',
				assignee: '__unassigned__',
				status: 'incomplete',
				rangeStart: '2026-02-26',
				rangeEnd: '2026-02-24'
			}).map((task) => task.id)
		).toEqual(['task-2']);
	});

	it('selection and reorder helpers should keep task focus stable', () => {
		const tasks = [
			taskFixture({ id: 'task-1', sortOrder: 1 }),
			taskFixture({ id: 'task-2', sortOrder: 0 })
		];
		const ordered = orderTasksForDisplay(tasks);

		expect(ordered.map((task) => task.id)).toEqual(['task-2', 'task-1']);
		expect(ensureSelectedTaskId(ordered, null)).toBe('task-2');
		expect(ensureSelectedTaskId(ordered, 'task-1')).toBe('task-1');
		expect(ensureSelectedTaskId([], 'task-1')).toBeNull();
		expect(reorderTaskIds(ordered, 'task-1', 'task-2')).toEqual(['task-1', 'task-2']);
		expect(reorderTaskIds(ordered, 'task-1', 'task-1')).toEqual([]);
		expect(reorderTaskIds(ordered, 'missing', 'task-1')).toBeNull();
	});

	it('preview and dependency helpers should detect stale previews and invalid predecessor', () => {
		const tasks = [
			taskFixture({ id: 'task-1' }),
			taskFixture({ id: 'task-2', predecessorTaskId: 'task-1', startDate: '2026-02-20' })
		];
		const trimmed = trimTaskDatePreviews(
			{
				'task-1': { startDate: '2026-02-20', endDate: '2026-02-21' },
				'task-missing': { startDate: '2026-02-20', endDate: '2026-02-21' }
			},
			tasks
		);

		expect(trimmed).toEqual({
			'task-1': { startDate: '2026-02-20', endDate: '2026-02-21' }
		});
		expect(
			hasDependencyViolation(tasks[1], Object.fromEntries(tasks.map((task) => [task.id, task])))
		).toBe(true);
	});

	it('dependency helpers should accept a Map index lookup', () => {
		const tasks = [
			taskFixture({ id: 'task-1', endDate: '2026-02-21' }),
			taskFixture({
				id: 'task-2',
				predecessorTaskId: 'task-1',
				startDate: '2026-02-22',
				endDate: '2026-02-23'
			})
		];

		const taskIndex = indexTasksById(tasks);

		expect(hasDependencyViolation(tasks[1], taskIndex)).toBe(false);
	});
});
