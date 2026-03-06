import { describe, expect, it } from 'vitest';
import {
	createTaskSchema,
	reorderTasksSchema,
	updateTaskSchema
} from './schemas';

describe('task schemas', () => {
	it('should parse valid task payloads', () => {
		expect(
			createTaskSchema.parse({
				title: '実装',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-02',
				progress: 0,
				assigneeIds: ['user-1'],
				predecessorTaskId: null
			})
		).toEqual({
			title: '実装',
			note: '',
			startDate: '2026-03-01',
			endDate: '2026-03-02',
			progress: 0,
			assigneeIds: ['user-1'],
			predecessorTaskId: null
		});
		expect(
			updateTaskSchema.parse({
				title: '更新',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).toEqual({
			title: '更新',
			updatedAt: '2026-03-01T00:00:00.000Z'
		});
		expect(reorderTasksSchema.parse({ ids: ['task-1', 'task-2'] })).toEqual({
			ids: ['task-1', 'task-2']
		});
	});

	it('should reject invalid task payloads', () => {
		expect(
			() =>
				createTaskSchema.parse({
					title: '',
					note: '',
					startDate: '2026-03-01',
					endDate: '2026-03-02',
					progress: 0,
					assigneeIds: [],
					predecessorTaskId: null
				})
		).toThrow();
		expect(() => updateTaskSchema.parse({ updatedAt: 'invalid-date' })).toThrow();
		expect(() => reorderTasksSchema.parse({ ids: [] })).toThrow();
	});
});
