import { describe, expect, it } from 'vitest';
import { load } from './+page';

describe('/admin/+page.ts', () => {
	it('should redirect to /admin/projects', () => {
		expect(() => load()).toThrowError(
			expect.objectContaining({
				status: 308,
				location: '/admin/projects'
			})
		);
	});
});
