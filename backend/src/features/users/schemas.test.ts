import { describe, expect, it } from 'vitest';
import { createUserSchema, updateUserSchema } from './schemas';

describe('user schemas', () => {
	it('should parse valid user payloads', () => {
		expect(createUserSchema.parse({ name: '伊藤' })).toEqual({ name: '伊藤' });
		expect(
			updateUserSchema.parse({
				name: '更新後',
				updatedAt: '2026-03-01T00:00:00.000Z'
			})
		).toEqual({
			name: '更新後',
			updatedAt: '2026-03-01T00:00:00.000Z'
		});
	});

	it('should reject invalid user payloads', () => {
		expect(() => createUserSchema.parse({ name: '' })).toThrow();
		expect(() => updateUserSchema.parse({ updatedAt: 'invalid-date' })).toThrow();
	});
});
