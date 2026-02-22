import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { resetTaskCacheForTest } from '$lib/tasksRepo';
import Page from './+page.svelte';

vi.mock('$lib/tasksRepo', async () => {
	const actual = await vi.importActual<typeof import('$lib/tasksRepo')>('$lib/tasksRepo');
	return {
		...actual,
		tasksRepoMode: 'local' as const,
		tasksRepo: actual.createTasksRepo('local')
	};
});

describe('/projects/+page.svelte', () => {
	beforeEach(() => {
		resetTaskCacheForTest();
	});

	it('should render project management page and allow creating a project', async () => {
		render(Page);

		await expect
			.element(page.getByRole('heading', { name: 'プロジェクト管理' }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Default Project')).toBeInTheDocument();
		await expect.element(page.getByText('Mobile App')).toBeInTheDocument();

		const input = page.getByRole('textbox', { name: '新規プロジェクト名' });
		await input.fill('New Project');
		await page.getByRole('button', { name: '追加' }).click();

		await expect.element(page.getByText('New Project')).toBeInTheDocument();
	});

	it('should filter projects by search query', async () => {
		render(Page);

		const searchInput = page.getByRole('searchbox', { name: 'プロジェクト検索' });
		await searchInput.fill('Default');

		await expect.element(page.getByText('Default Project')).toBeInTheDocument();
		await expect.element(page.getByText('Mobile App')).not.toBeInTheDocument();
	});
});
