import { describe, expect, it } from 'vitest';
import type { Task, User } from '$lib/data/tasks/repo';
import {
	buildAssigneeNamesByTaskId,
	createTaskFormForCreate,
	ensureSelectedTaskId,
	filterTasksByFilters,
	hasActiveTaskFilters,
	hasDependencyViolation,
	isTaskOverdue,
	indexTasksById,
	orderTasksForDisplay,
	resolveTaskAssigneeNames,
	resolveTaskAssigneeSummary,
	resolveTaskDisplayEnd,
	resolveTaskDisplayStart,
	reorderTaskIds,
	trimTaskDatePreviews,
	withTaskDatePreview,
	withoutTaskDatePreview
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

function userFixture(partial: Partial<User> = {}): User {
	return {
		id: 'user-1',
		name: '伊藤',
		updatedAt: '2026-02-20T00:00:00.000Z',
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

	it('isTaskOverdue should only flag incomplete tasks after their end date', () => {
		expect(
			isTaskOverdue(
				taskFixture({
					id: 'task-overdue',
					endDate: '2026-02-21',
					progress: 10
				}),
				'2026-02-22'
			)
		).toBe(true);
		expect(
			isTaskOverdue(
				taskFixture({
					id: 'task-due-today',
					endDate: '2026-02-21',
					progress: 10
				}),
				'2026-02-21'
			)
		).toBe(false);
		expect(
			isTaskOverdue(
				taskFixture({
					id: 'task-complete',
					endDate: '2026-02-21',
					progress: 100
				}),
				'2026-02-22'
			)
		).toBe(false);
	});

	it('assignee/date/form helpers should provide display-safe values', () => {
		const tasks = [
			taskFixture({ id: 'task-1', assigneeIds: ['user-1'] }),
			taskFixture({ id: 'task-2', assigneeIds: [] })
		];
		const users = [userFixture()];
		const namesByTaskId = buildAssigneeNamesByTaskId(tasks, users);

		expect(resolveTaskAssigneeNames(namesByTaskId, 'task-1')).toEqual(['伊藤']);
		expect(resolveTaskAssigneeSummary(namesByTaskId, 'task-2')).toBe('未割り当て');

		const previews = withTaskDatePreview({}, 'task-1', '2026-03-01', '2026-03-05');
		expect(resolveTaskDisplayStart(previews, tasks[0])).toBe('2026-03-01');
		expect(resolveTaskDisplayEnd(previews, tasks[0])).toBe('2026-03-05');
		expect(withoutTaskDatePreview(previews, 'task-1')).toEqual({});

		const form = createTaskFormForCreate(
			{
				title: '',
				note: '',
				startDate: '',
				endDate: '',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: ''
			},
			new Date('2026-03-10T00:00:00.000Z')
		);
		expect(form.startDate).toBe('2026-03-10');
		expect(form.endDate).toBe('2026-03-12');
	});
});
