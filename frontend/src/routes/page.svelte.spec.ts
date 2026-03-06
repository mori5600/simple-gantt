import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { resetTaskCacheForTest, tasksRepo } from '$lib/data/tasks/repo';
import Page from './+page.svelte';

const FILTERS_STORAGE_KEY = 'simple-gantt:task-filters:v1';
const PROJECT_STORAGE_KEY = 'simple-gantt:selected-project:v1';

vi.mock('$lib/data/tasks/repo', async () => {
	const actual =
		await vi.importActual<typeof import('$lib/data/tasks/repo')>('$lib/data/tasks/repo');
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

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should render toolbar controls', async () => {
		await renderPage();
		await expect.element(page.getByRole('combobox', { name: 'Project' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'タスク追加' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: '編集' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: '取込' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: '出力' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: '今日' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Day' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Week' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Month' })).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: '管理' })).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: '設定' })).toBeInTheDocument();
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

	it('should restore selected project from localStorage on first render', async () => {
		localStorage.setItem(PROJECT_STORAGE_KEY, 'project-mobile');

		render(Page);

		await expect.element(page.getByTitle('API接続', { exact: true })).toBeInTheDocument();
		await expect
			.element(page.getByRole('combobox', { name: 'Project' }))
			.toHaveValue('project-mobile');
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

	it('should persist active filters and clear storage when filters are reset', async () => {
		await renderPage();

		const searchInput = page.getByRole('searchbox', { name: 'Search' });
		const resetButton = page.getByRole('button', { name: 'リセット' });

		await searchInput.fill('要件');

		await vi.waitFor(() => {
			const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
			expect(stored).not.toBeNull();
			expect(JSON.parse(stored as string)).toEqual({
				query: '要件',
				assignee: '',
				status: 'all',
				rangeStart: '',
				rangeEnd: ''
			});
		});

		await resetButton.click();
		await expect.element(searchInput).toHaveValue('');
		await vi.waitFor(() => {
			expect(localStorage.getItem(FILTERS_STORAGE_KEY)).toBeNull();
		});
	});

	it('should open and close create task modal', async () => {
		await renderPage();

		await page.getByRole('button', { name: 'タスク追加' }).click();
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

		await expect.element(page.getByRole('button', { name: '編集' })).toBeEnabled();
	});

	it('should show overdue summary and timeline title for overdue tasks', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
		await tasksRepo.list('project-default');
		vi.setSystemTime(new Date('2026-03-10T00:00:00.000Z'));

		await renderPage();

		await expect.element(page.getByText('遅延 1件')).toBeInTheDocument();
		await expect
			.element(page.getByTitle('UI実装 / 担当: 佐藤, 山田 / 遅延中', { exact: true }))
			.toBeInTheDocument();
	});

	it('should scroll timeline to today when the today button is clicked', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
		await tasksRepo.create('project-default', {
			title: '長期タスク',
			note: '',
			startDate: '2025-12-01',
			endDate: '2026-06-01',
			progress: 30,
			assigneeIds: [],
			predecessorTaskId: null
		});

		await renderPage();

		const todayLine = page.getByTestId('gantt-today-line');
		await expect.element(todayLine).toBeInTheDocument();
		const scrollIntoViewSpy = vi.spyOn(todayLine.element(), 'scrollIntoView');

		await page.getByRole('button', { name: '今日' }).click();

		expect(scrollIntoViewSpy).toHaveBeenCalledOnce();
		expect(scrollIntoViewSpy).toHaveBeenCalledWith({
			block: 'nearest',
			inline: 'center'
		});
		scrollIntoViewSpy.mockRestore();
	});
});
