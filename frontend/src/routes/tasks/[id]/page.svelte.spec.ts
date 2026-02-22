import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { resetTaskCacheForTest } from '$lib/tasksRepo';
import TaskEditPage from './+page.svelte';

const { mockedPage } = vi.hoisted(() => ({
	mockedPage: {
		params: { id: 'task-discovery' },
		url: new URL('http://localhost/tasks/task-discovery?projectId=project-default')
	}
}));

vi.mock('$app/state', () => ({
	page: mockedPage
}));

vi.mock('$lib/tasksRepo', async () => {
	const actual = await vi.importActual<typeof import('$lib/tasksRepo')>('$lib/tasksRepo');
	return {
		...actual,
		tasksRepoMode: 'local' as const,
		tasksRepo: actual.createTasksRepo('local')
	};
});

describe('/tasks/[id]/+page.svelte', () => {
	beforeEach(() => {
		resetTaskCacheForTest();
	});

	it('should render task editor with history entries', async () => {
		render(TaskEditPage);

		await expect.element(page.getByRole('heading', { name: 'タスク編集' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: '保存' })).toBeInTheDocument();
		await expect.element(page.getByText('変更履歴')).toBeInTheDocument();
		await expect.element(page.getByText('created')).toBeInTheDocument();
	});

	it('should update task and append history entry', async () => {
		render(TaskEditPage);

		const titleInput = page.getByRole('textbox', { name: 'title' });
		await titleInput.fill('要件確認 更新');
		await page.getByRole('button', { name: '保存' }).click();

		await expect.element(page.getByText('タスクを更新しました。')).toBeInTheDocument();
		await expect.element(page.getByText('updated')).toBeInTheDocument();
	});
});
