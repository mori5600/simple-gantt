import { describe, expect, it } from 'vitest';
import type { TaskWithAssignees } from '../models/task-model';
import {
	toApiProject,
	toApiProjectSummary,
	toApiTask,
	toApiUser,
	toApiUserSummary
} from './serializers';

describe('serializers', () => {
	it('toApiUser should return id and name', () => {
		const updatedAt = new Date('2026-02-19T00:00:00.000Z');
		const actual = toApiUser({
			id: 'user-1',
			name: '山田',
			updatedAt
		});

		expect(actual).toEqual({
			id: 'user-1',
			name: '山田',
			updatedAt: updatedAt.toISOString()
		});
	});

	it('toApiProject should return project payload', () => {
		const updatedAt = new Date('2026-02-20T00:00:00.000Z');
		const actual = toApiProject({
			id: 'project-1',
			name: 'Demo Project',
			sortOrder: 2,
			updatedAt
		});

		expect(actual).toEqual({
			id: 'project-1',
			name: 'Demo Project',
			sortOrder: 2,
			updatedAt: updatedAt.toISOString()
		});
	});

	it('toApiProjectSummary should include taskCount', () => {
		const updatedAt = new Date('2026-02-20T00:00:00.000Z');
		const actual = toApiProjectSummary({
			id: 'project-1',
			name: 'Demo Project',
			sortOrder: 2,
			updatedAt,
			taskCount: 7
		});

		expect(actual).toEqual({
			id: 'project-1',
			name: 'Demo Project',
			sortOrder: 2,
			updatedAt: updatedAt.toISOString(),
			taskCount: 7
		});
	});

	it('toApiUserSummary should include taskCount', () => {
		const updatedAt = new Date('2026-02-20T00:00:00.000Z');
		const actual = toApiUserSummary({
			id: 'user-1',
			name: '田中',
			updatedAt,
			taskCount: 3
		});

		expect(actual).toEqual({
			id: 'user-1',
			name: '田中',
			updatedAt: updatedAt.toISOString(),
			taskCount: 3
		});
	});

	it('toApiTask should map assignees and include note', () => {
		const source = {
			id: 'task-1',
			projectId: 'project-1',
			title: '設計',
			note: '議論メモ',
			startDate: '2026-02-19',
			endDate: '2026-02-21',
			progress: 30,
			sortOrder: 1,
			predecessorTaskId: null,
			createdAt: new Date('2026-02-19T00:00:00.000Z'),
			updatedAt: new Date('2026-02-19T00:00:00.000Z'),
			assignees: [{ userId: 'user-1' }, { userId: 'user-2' }]
		} as TaskWithAssignees;

		const actual = toApiTask(source);

		expect(actual).toEqual({
			id: 'task-1',
			projectId: 'project-1',
			title: '設計',
			note: '議論メモ',
			startDate: '2026-02-19',
			endDate: '2026-02-21',
			progress: 30,
			sortOrder: 1,
			updatedAt: '2026-02-19T00:00:00.000Z',
			assigneeIds: ['user-1', 'user-2'],
			predecessorTaskId: null
		});
	});
});
