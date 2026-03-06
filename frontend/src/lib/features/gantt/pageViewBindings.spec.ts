import { describe, expect, it } from 'vitest';
import type { Task, User } from '$lib/data/tasks/repo';
import type { ListColumnWidths, TaskDateRange, ZoomLevel } from './types';
import type { TaskFilters } from './filterStorage';
import { createGanttPageViewBindings } from './pageViewBindings';

function taskFixture(partial: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		projectId: 'project-1',
		title: '要件確認',
		note: '',
		startDate: '2026-03-01',
		endDate: '2026-03-03',
		progress: 20,
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

describe('pageViewBindings', () => {
	it('resetFilters should restore defaults', () => {
		let taskFilters: TaskFilters = {
			query: 'x',
			assignee: 'user-1',
			status: 'incomplete',
			rangeStart: '2026-03-01',
			rangeEnd: '2026-03-05'
		};

		const bindings = createGanttPageViewBindings({
			state: {
				read: () => ({
					assigneeNamesByTaskId: {},
					orderedTasks: [],
					projectMembers: [],
					taskDatePreviews: {},
					taskById: new Map<string, Task>()
				}),
				setIsListColumnAuto: () => {},
				setListColumnWidths: () => {},
				setSelectedTaskId: () => {},
				setTaskFilters: (value) => {
					taskFilters = value;
				},
				setZoom: () => {}
			},
			defaultTaskFilters: {
				query: '',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			}
		});

		bindings.resetFilters();

		expect(taskFilters).toEqual({
			query: '',
			assignee: '',
			status: 'all',
			rangeStart: '',
			rangeEnd: ''
		});
	});

	it('autoFitListColumns should set auto mode and recompute widths', () => {
		let isAuto = false;
		let listColumnWidths: ListColumnWidths = [220, 170, 112, 112, 132];
		const orderedTasks = [taskFixture({ title: 'かなり長いタイトルのタスクです' })];
		const members = [userFixture({ name: '長い名前の担当者' })];

		const bindings = createGanttPageViewBindings({
			state: {
				read: () => ({
					assigneeNamesByTaskId: {},
					orderedTasks,
					projectMembers: members,
					taskDatePreviews: {},
					taskById: new Map<string, Task>()
				}),
				setIsListColumnAuto: (value) => {
					isAuto = value;
				},
				setListColumnWidths: (value) => {
					listColumnWidths = value;
				},
				setSelectedTaskId: () => {},
				setTaskFilters: () => {},
				setZoom: () => {}
			},
			defaultTaskFilters: {
				query: '',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			}
		});

		bindings.autoFitListColumns();

		expect(isAuto).toBe(true);
		expect(listColumnWidths).not.toEqual([220, 170, 112, 112, 132]);
	});

	it('display helpers should resolve assignee and preview values', () => {
		let zoom: ZoomLevel = 'day';
		let selectedTaskId = '';
		const previews: Record<string, TaskDateRange> = {
			'task-1': {
				startDate: '2026-03-10',
				endDate: '2026-03-11'
			}
		};
		const task = taskFixture({ assigneeIds: ['user-1'] });
		const taskById = new Map<string, Task>([['task-1', task]]);

		const bindings = createGanttPageViewBindings({
			state: {
				read: () => ({
					assigneeNamesByTaskId: { 'task-1': ['伊藤'] },
					orderedTasks: [task],
					projectMembers: [userFixture()],
					taskDatePreviews: previews,
					taskById
				}),
				setIsListColumnAuto: () => {},
				setListColumnWidths: () => {},
				setSelectedTaskId: (value) => {
					selectedTaskId = value;
				},
				setTaskFilters: () => {},
				setZoom: (value) => {
					zoom = value;
				}
			},
			defaultTaskFilters: {
				query: '',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			}
		});

		bindings.setZoom('week');
		bindings.selectTask('task-1');

		expect(zoom).toBe('week');
		expect(selectedTaskId).toBe('task-1');
		expect(bindings.getAssigneeNames(task)).toEqual(['伊藤']);
		expect(bindings.getAssigneeSummary(task)).toBe('伊藤');
		expect(bindings.getDisplayStart(task)).toBe('2026-03-10');
		expect(bindings.getDisplayEnd(task)).toBe('2026-03-11');
		expect(bindings.hasDependencyViolation(task)).toBe(false);
	});
});
