import { describe, expect, it } from 'vitest';
import type { Task, User } from '$lib/data/tasks/repo';
import {
	computeAutoColumnWidths,
	getAssigneeNames,
	getAssigneeSummary,
	LIST_COLUMN_MIN_WIDTHS,
	normalizeListColumnWidths
} from './listColumns';

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

const users: User[] = [
	{ id: 'user-1', name: '伊藤', updatedAt: '2026-03-01T00:00:00.000Z' },
	{ id: 'user-2', name: '佐藤花子', updatedAt: '2026-03-01T00:00:00.000Z' }
];

describe('listColumns helpers', () => {
	it('normalizeListColumnWidths should round values and enforce minimum widths', () => {
		expect(normalizeListColumnWidths([100.2, 118.5, 95.2, 40.8, 131.7])).toEqual([
			LIST_COLUMN_MIN_WIDTHS[0],
			120,
			LIST_COLUMN_MIN_WIDTHS[2],
			LIST_COLUMN_MIN_WIDTHS[3],
			132
		]);
	});

	it('getAssigneeNames and getAssigneeSummary should resolve known users and fallback ids', () => {
		const assignedTask = taskFixture({ assigneeIds: ['user-1', 'user-missing'] });
		const unassignedTask = taskFixture({ assigneeIds: [] });

		expect(getAssigneeNames(assignedTask, users)).toEqual(['伊藤', 'user-missing']);
		expect(getAssigneeSummary(assignedTask, users)).toBe('伊藤, user-missing');
		expect(getAssigneeSummary(unassignedTask, users)).toBe('未割り当て');
	});

	it('computeAutoColumnWidths should size task and assignee columns from visible content', () => {
		const widths = computeAutoColumnWidths(
			[
				taskFixture({ title: '短いタスク', assigneeIds: [] }),
				taskFixture({
					id: 'task-2',
					title: 'とても長いタイトルのタスク名を使って横幅計算を確認する',
					assigneeIds: ['user-2', 'user-missing']
				})
			],
			users
		);

		expect(widths[0]).toBeGreaterThanOrEqual(160);
		expect(widths[0]).toBeLessThanOrEqual(420);
		expect(widths[1]).toBeGreaterThanOrEqual(130);
		expect(widths[1]).toBeLessThanOrEqual(320);
		expect(widths[2]).toBe(112);
		expect(widths[3]).toBe(112);
		expect(widths[4]).toBe(132);
		expect(widths[1]).toBeGreaterThan(LIST_COLUMN_MIN_WIDTHS[1]);
	});
});
