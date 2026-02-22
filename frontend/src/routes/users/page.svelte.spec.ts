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

describe('/users/+page.svelte', () => {
	beforeEach(() => {
		resetTaskCacheForTest();
	});

	it('should render user management page and allow creating a user', async () => {
		render(Page);

		await expect.element(page.getByRole('heading', { name: 'ユーザー管理' })).toBeInTheDocument();
		await expect.element(page.getByText('伊藤')).toBeInTheDocument();
		await expect.element(page.getByText('佐藤')).toBeInTheDocument();

		const input = page.getByRole('textbox', { name: '新規ユーザー名' });
		await input.fill('田中');
		await page.getByRole('button', { name: '追加' }).click();

		await expect.element(page.getByText('田中')).toBeInTheDocument();
	});

	it('should filter users by search query', async () => {
		render(Page);

		const searchInput = page.getByRole('searchbox', { name: 'ユーザー検索' });
		await searchInput.fill('伊藤');

		await expect.element(page.getByText('伊藤')).toBeInTheDocument();
		await expect.element(page.getByText('佐藤')).not.toBeInTheDocument();
	});
});
