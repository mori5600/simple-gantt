import { describe, expect, it } from 'vitest';
import {
	createProjectSchema,
	reorderProjectsSchema,
	setProjectMembersSchema,
	updateProjectSchema
} from './schemas';

describe('project schemas', () => {
	it('should parse valid project payloads', () => {
		expect(createProjectSchema.parse({ name: '新規プロジェクト' })).toEqual({
			name: '新規プロジェクト'
		});
		expect(
			updateProjectSchema.parse({
				name: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).toEqual({
			name: '更新後',
			updatedAt: '2026-03-01T00:00:00.000Z'
		});
		expect(reorderProjectsSchema.parse({ ids: ['project-1', 'project-2'] })).toEqual({
			ids: ['project-1', 'project-2']
		});
		expect(setProjectMembersSchema.parse({ userIds: ['user-1'] })).toEqual({
			userIds: ['user-1']
		});
	});

	it('should reject invalid project payloads', () => {
		expect(() => createProjectSchema.parse({ name: '' })).toThrow();
		expect(() => updateProjectSchema.parse({ updatedAt: 'invalid-date' })).toThrow();
		expect(() => reorderProjectsSchema.parse({ ids: [] })).toThrow();
		expect(() => setProjectMembersSchema.parse({ userIds: [''] })).toThrow();
	});
});
