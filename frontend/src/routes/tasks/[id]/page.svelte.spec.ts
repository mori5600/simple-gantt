import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { resetTaskCacheForTest, tasksRepo } from '$lib/data/tasks/repo';
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

vi.mock('$lib/data/tasks/repo', async () => {
	const actual =
		await vi.importActual<typeof import('$lib/data/tasks/repo')>('$lib/data/tasks/repo');
	return {
		...actual,
		tasksRepoMode: 'local' as const,
		tasksRepo: actual.createTasksRepo('local')
	};
});

describe('/tasks/[id]/+page.svelte', () => {
	beforeEach(() => {
		resetTaskCacheForTest();
		mockedPage.params.id = 'task-discovery';
		mockedPage.url = new URL('http://localhost/tasks/task-discovery?projectId=project-default');
	});

	it('should render task editor with history entries', async () => {
		render(TaskEditPage);

		await expect.element(page.getByRole('heading', { name: 'タスク編集' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: '保存' })).toBeInTheDocument();
		await expect.element(page.getByText('変更履歴')).toBeInTheDocument();
		await expect.element(page.getByText('created')).toBeInTheDocument();
		await expect
			.element(page.getByText(/\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}:\d{2}/))
			.toBeInTheDocument();
		await expect
			.element(page.getByText(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/))
			.not.toBeInTheDocument();
	});

	it('should update task and append history entry', async () => {
		render(TaskEditPage);

		const titleInput = page.getByRole('textbox', { name: 'title' });
		await titleInput.fill('要件確認 更新');
		const noteInput = document.querySelector('textarea[name="taskNote"]');
		const startDateInput = document.querySelector('input[name="taskStartDate"]');
		const endDateInput = document.querySelector('input[name="taskEndDate"]');
		const progressInput = document.querySelector('input[name="taskProgress"]');
		const assigneeCheckbox = document.querySelector('input[type="checkbox"][value="user-sato"]');
		if (
			!(noteInput instanceof HTMLTextAreaElement) ||
			!(startDateInput instanceof HTMLInputElement) ||
			!(endDateInput instanceof HTMLInputElement) ||
			!(progressInput instanceof HTMLInputElement) ||
			!(assigneeCheckbox instanceof HTMLInputElement)
		) {
			throw new Error('expected task edit fields');
		}
		noteInput.value = '更新メモ';
		noteInput.dispatchEvent(new Event('input', { bubbles: true }));
		startDateInput.value = '2026-03-02';
		startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
		endDateInput.value = '2026-03-04';
		endDateInput.dispatchEvent(new Event('input', { bubbles: true }));
		progressInput.value = '80';
		progressInput.dispatchEvent(new Event('input', { bubbles: true }));
		assigneeCheckbox.checked = true;
		assigneeCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
		await page.getByRole('button', { name: '保存' }).click();

		await expect.element(page.getByText('タスクを更新しました。')).toBeInTheDocument();
		await expect.element(page.getByText('updated')).toBeInTheDocument();
		expect(document.body.textContent).toContain(
			'fields: title, note, startDate, endDate, progress, assigneeIds'
		);

		const updatedTask = (await tasksRepo.list('project-default')).find(
			(task) => task.id === 'task-discovery'
		);
		expect(updatedTask).toMatchObject({
			title: '要件確認 更新',
			note: '更新メモ',
			startDate: '2026-03-02',
			endDate: '2026-03-04',
			progress: 80
		});
		expect(updatedTask?.assigneeIds).toContain('user-sato');
	});

	it('should validate required query params before loading', async () => {
		mockedPage.url = new URL('http://localhost/tasks/task-discovery');
		render(TaskEditPage);

		await expect.element(page.getByText('projectId クエリは必須です。')).toBeInTheDocument();
	});

	it('should validate missing task ids before loading', async () => {
		mockedPage.params.id = '';
		mockedPage.url = new URL('http://localhost/tasks/?projectId=project-default');
		render(TaskEditPage);

		await expect.element(page.getByText('taskId が不正です。')).toBeInTheDocument();
	});

	it('should show load errors and missing task errors', async () => {
		mockedPage.params.id = 'missing-task';
		mockedPage.url = new URL('http://localhost/tasks/missing-task?projectId=project-default');
		render(TaskEditPage);

		await expect.element(page.getByText('task not found: missing-task')).toBeInTheDocument();

		resetTaskCacheForTest();
		mockedPage.params.id = 'task-discovery';
		mockedPage.url = new URL('http://localhost/tasks/task-discovery?projectId=project-default');
		const listSpy = vi.spyOn(tasksRepo, 'list').mockRejectedValueOnce(new Error('load failed'));
		render(TaskEditPage);

		await expect.element(page.getByText('load failed')).toBeInTheDocument();
		listSpy.mockRestore();
	});

	it('should show form validation errors without submitting', async () => {
		render(TaskEditPage);

		await expect.element(page.getByRole('textbox', { name: 'title' })).toBeInTheDocument();
		const titleInput = document.querySelector('input[name="taskTitle"]');
		const form = document.querySelector('form');
		if (!(titleInput instanceof HTMLInputElement)) {
			throw new Error('expected title input');
		}
		if (!(form instanceof HTMLFormElement)) {
			throw new Error('expected task edit form');
		}
		titleInput.value = '';
		titleInput.dispatchEvent(new Event('input', { bubbles: true }));
		form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

		await expect.element(page.getByText('タイトルは必須です。')).toBeInTheDocument();
	});

	it('should handle predecessor selection, invalid history timestamps, and update failures', async () => {
		const historySpy = vi.spyOn(tasksRepo, 'listTaskHistory').mockResolvedValueOnce([
			{
				id: 'history-invalid',
				taskId: 'task-discovery',
				projectId: 'project-default',
				action: 'updated',
				changedFields: ['title'],
				title: '壊れた履歴',
				note: '',
				startDate: '2026-03-01',
				endDate: '2026-03-01',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: null,
				createdAt: 'invalid-history-date'
			}
		]);
		render(TaskEditPage);

		await expect.element(page.getByText('invalid-history-date')).toBeInTheDocument();
		historySpy.mockRestore();

		const predecessorSelect = document.querySelector('select[name="taskPredecessorTaskId"]');
		if (!(predecessorSelect instanceof HTMLSelectElement)) {
			throw new Error('expected predecessor select');
		}
		predecessorSelect.value = 'task-ui';
		predecessorSelect.dispatchEvent(new Event('change', { bubbles: true }));
		expect(predecessorSelect.value).toBe('task-ui');

		const updateSpy = vi
			.spyOn(tasksRepo, 'update')
			.mockRejectedValueOnce(new Error('update failed'));
		await page.getByRole('button', { name: '保存' }).click();

		await expect.element(page.getByText('update failed')).toBeInTheDocument();
		updateSpy.mockRestore();
	});
});
