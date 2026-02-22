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

async function renderPage(): Promise<void> {
	render(Page);
	await expect
		.element(page.getByRole('heading', { name: /プロジェクト ガント/ }))
		.toBeInTheDocument();
	await expect.element(page.getByTitle('要件確認', { exact: true })).toBeInTheDocument();
}

describe('/+page.svelte', () => {
	beforeEach(() => {
		resetTaskCacheForTest();
		if (typeof localStorage !== 'undefined') {
			localStorage.clear();
		}
	});

	it('should render toolbar controls', async () => {
		await renderPage();
		await expect.element(page.getByRole('combobox', { name: 'Project' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Task 追加' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: '出力' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Day' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Week' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Month' })).toBeInTheDocument();
	});

	it('should open export menu and show csv/xlsx options', async () => {
		await renderPage();

		await page.getByRole('button', { name: '出力' }).click();

		await expect.element(page.getByRole('button', { name: 'CSV' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'XLSX' })).toBeInTheDocument();
	});

	it('should switch project and update visible task rows', async () => {
		await renderPage();

		const projectSelect = page.getByRole('combobox', { name: 'Project' });
		await projectSelect.selectOptions('project-mobile');

		await expect.element(page.getByTitle('API接続', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByTitle('結合確認', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByTitle('要件確認', { exact: true })).not.toBeInTheDocument();
	});

	it('should toggle zoom selection state', async () => {
		await renderPage();

		const dayButton = page.getByRole('button', { name: 'Day' });
		const monthButton = page.getByRole('button', { name: 'Month' });

		await expect.element(dayButton).toHaveAttribute('aria-pressed', 'true');
		await expect.element(monthButton).toHaveAttribute('aria-pressed', 'false');

		await monthButton.click();

		await expect.element(dayButton).toHaveAttribute('aria-pressed', 'false');
		await expect.element(monthButton).toHaveAttribute('aria-pressed', 'true');
		const now = new Date();
		const currentMonthLabel = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
		await expect
			.element(page.getByTestId('month-header-band').getByTitle(currentMonthLabel, { exact: true }))
			.toBeInTheDocument();
	});

	it('should filter by query and reset to default state', async () => {
		await renderPage();

		const searchInput = page.getByRole('searchbox', { name: 'Search' });
		const resetButton = page.getByRole('button', { name: 'リセット' });

		await expect.element(resetButton).toBeDisabled();
		await expect.element(page.getByText('2 / 2 tasks')).toBeInTheDocument();

		await searchInput.fill('要件');

		await expect.element(page.getByText('1 / 2 tasks')).toBeInTheDocument();
		await expect.element(resetButton).toBeEnabled();

		await resetButton.click();

		await expect.element(searchInput).toHaveValue('');
		await expect.element(page.getByText('2 / 2 tasks')).toBeInTheDocument();
		await expect.element(resetButton).toBeDisabled();
	});

	it('should open and close create task modal', async () => {
		await renderPage();

		await page.getByRole('button', { name: 'Task 追加' }).click();
		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'タスク追加' })).toBeInTheDocument();
		const noteField = page.getByRole('textbox', { name: 'note' });
		await expect.element(noteField).toBeInTheDocument();
		await noteField.fill('議論メモ');
		await expect.element(noteField).toHaveValue('議論メモ');

		await page.getByRole('button', { name: 'close' }).click();
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('should keep edit button enabled when task is selected', async () => {
		await renderPage();

		await expect.element(page.getByRole('button', { name: 'Edit' })).toBeEnabled();
	});
});
