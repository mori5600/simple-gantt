import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { resetTaskCacheForTest } from '$lib/data/tasks/repo';
import Page from './+page.svelte';

vi.mock('$lib/data/tasks/repo', async () => {
	const actual =
		await vi.importActual<typeof import('$lib/data/tasks/repo')>('$lib/data/tasks/repo');
	return {
		...actual,
		tasksRepoMode: 'local' as const,
		tasksRepo: actual.createTasksRepo('local')
	};
});

describe('/admin/projects/+page.svelte', () => {
	beforeEach(() => {
		resetTaskCacheForTest();
	});

	it('should render project management view without gantt-back link', async () => {
		render(Page);

		await expect
			.element(page.getByRole('heading', { name: 'プロジェクト管理' }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'ガントへ戻る' })).not.toBeInTheDocument();
	});
});
