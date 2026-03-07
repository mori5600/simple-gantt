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
	await expect.element(page.getByRole('combobox', { name: 'Project' })).toBeInTheDocument();
	await expect.element(page.getByTitle('要件確認', { exact: true })).toBeInTheDocument();
}

function queryInput(selector: string): HTMLInputElement {
	const input = document.querySelector(selector);
	if (!(input instanceof HTMLInputElement)) {
		throw new Error(`expected input: ${selector}`);
	}
	return input;
}

function queryTextarea(selector: string): HTMLTextAreaElement {
	const textarea = document.querySelector(selector);
	if (!(textarea instanceof HTMLTextAreaElement)) {
		throw new Error(`expected textarea: ${selector}`);
	}
	return textarea;
}

function querySelect(selector: string): HTMLSelectElement {
	const select = document.querySelector(selector);
	if (!(select instanceof HTMLSelectElement)) {
		throw new Error(`expected select: ${selector}`);
	}
	return select;
}

function extractPaneWidth(styleValue: string | null): number {
	const match = styleValue?.match(/--task-pane-width:\s*(\d+)px/);
	if (!match) {
		throw new Error(`expected pane width in style: ${styleValue}`);
	}
	return Number(match[1]);
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

	it('should create a task through the modal and persist all edited fields', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
		await renderPage();

		await page.getByRole('button', { name: 'タスク追加' }).click();

		const titleInput = queryInput('input[name="taskTitle"]');
		const noteInput = queryTextarea('textarea[name="taskNote"]');
		const startDateInput = queryInput('input[name="taskStartDate"]');
		const endDateInput = queryInput('input[name="taskEndDate"]');
		const progressInput = queryInput('input[name="taskProgress"]');
		const predecessorSelect = querySelect('select[name="taskPredecessorTaskId"]');
		const assigneeCheckbox = queryInput('input[type="checkbox"][value="user-ito"]');

		titleInput.value = '追加タスク';
		titleInput.dispatchEvent(new Event('input', { bubbles: true }));
		noteInput.value = '追加メモ';
		noteInput.dispatchEvent(new Event('input', { bubbles: true }));
		startDateInput.value = '2026-03-10';
		startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
		endDateInput.value = '2026-03-12';
		endDateInput.dispatchEvent(new Event('input', { bubbles: true }));
		progressInput.value = '55';
		progressInput.dispatchEvent(new Event('input', { bubbles: true }));
		predecessorSelect.value = 'task-discovery';
		predecessorSelect.dispatchEvent(new Event('change', { bubbles: true }));
		assigneeCheckbox.checked = true;
		assigneeCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

		const modalForm = document.querySelector('[role="dialog"] form');
		if (!(modalForm instanceof HTMLFormElement)) {
			throw new Error('expected modal form');
		}
		modalForm.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(page.getByTitle('追加タスク', { exact: true })).toBeInTheDocument();

		const created = (await tasksRepo.list('project-default')).find(
			(task) => task.title === '追加タスク'
		);
		expect(created).toMatchObject({
			note: '追加メモ',
			startDate: '2026-03-10',
			endDate: '2026-03-12',
			progress: 55,
			assigneeIds: ['user-ito'],
			predecessorTaskId: 'task-discovery'
		});
	});

	it('should apply assignee, status, and date range filters', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
		await renderPage();

		await page.getByRole('combobox', { name: 'Assignee' }).selectOptions('user-ito');
		await page.getByRole('combobox', { name: 'Status' }).selectOptions('complete');

		const fromInput = queryInput('input[name="taskFilterRangeStart"]');
		const toInput = queryInput('input[name="taskFilterRangeEnd"]');
		fromInput.value = '2026-02-27';
		fromInput.dispatchEvent(new Event('input', { bubbles: true }));
		toInput.value = '2026-03-02';
		toInput.dispatchEvent(new Event('input', { bubbles: true }));

		await expect.element(page.getByText('1 / 2 tasks')).toBeInTheDocument();
		await expect.element(page.getByTitle('要件確認', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByTitle('UI実装', { exact: true })).not.toBeInTheDocument();

		await vi.waitFor(() => {
			expect(JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY) as string)).toEqual({
				query: '',
				assignee: 'user-ito',
				status: 'complete',
				rangeStart: '2026-02-27',
				rangeEnd: '2026-03-02'
			});
		});
	});

	it('should delete the selected task after confirmation', async () => {
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
		await renderPage();

		await page.getByRole('button', { name: '削除' }).click();

		expect(confirmSpy).toHaveBeenCalledWith('"要件確認" を削除します。よろしいですか？');
		await vi.waitFor(async () => {
			const tasks = await tasksRepo.list('project-default');
			expect(tasks.some((task) => task.title === '要件確認')).toBe(false);
		});
		await expect.element(page.getByText('1 / 1 tasks')).toBeInTheDocument();
		confirmSpy.mockRestore();
	});

	it('should resize the task list pane and restore widths with auto fit', async () => {
		await renderPage();

		const grid = document.querySelector('main > div');
		if (!(grid instanceof HTMLDivElement)) {
			throw new Error('expected grid container');
		}

		const initialWidth = extractPaneWidth(grid.getAttribute('style'));

		const handle = page.getByRole('button', { name: 'Resize task column' }).element();
		handle.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				button: 0,
				pointerId: 1,
				clientX: 100
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointermove', {
				pointerId: 1,
				clientX: 40
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				pointerId: 1
			})
		);

		await vi.waitFor(() => {
			expect(extractPaneWidth(grid.getAttribute('style'))).toBeLessThan(initialWidth);
		});

		await page.getByRole('button', { name: 'Auto Fit' }).click();

		await vi.waitFor(() => {
			expect(extractPaneWidth(grid.getAttribute('style'))).toBe(initialWidth);
		});
	});

	it('should commit task date changes when dragging a timeline bar', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
		await tasksRepo.create('project-default', {
			title: 'ドラッグ確認',
			note: '',
			startDate: '2026-03-10',
			endDate: '2026-03-12',
			progress: 0,
			assigneeIds: [],
			predecessorTaskId: null
		});
		await renderPage();

		const timelineTask = document.querySelector('button[title="ドラッグ確認 / 担当: 未割り当て"]');
		if (!(timelineTask instanceof HTMLButtonElement)) {
			throw new Error('expected timeline task button');
		}

		timelineTask.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				button: 0,
				pointerId: 9,
				clientX: 100
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointermove', {
				pointerId: 9,
				clientX: 130
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				pointerId: 9
			})
		);

		await vi.waitFor(async () => {
			const updated = (await tasksRepo.list('project-default')).find(
				(task) => task.title === 'ドラッグ確認'
			);
			expect(updated).toMatchObject({
				startDate: '2026-03-11',
				endDate: '2026-03-13'
			});
		});
	});

	it('should undo the latest task date change from the toolbar button', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
		await tasksRepo.create('project-default', {
			title: 'Undo確認',
			note: '',
			startDate: '2026-03-10',
			endDate: '2026-03-12',
			progress: 0,
			assigneeIds: [],
			predecessorTaskId: null
		});
		await renderPage();

		const timelineTask = document.querySelector('button[title="Undo確認 / 担当: 未割り当て"]');
		if (!(timelineTask instanceof HTMLButtonElement)) {
			throw new Error('expected timeline task button');
		}

		timelineTask.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				button: 0,
				pointerId: 11,
				clientX: 100
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointermove', {
				pointerId: 11,
				clientX: 130
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				pointerId: 11
			})
		);

		const undoButton = page.getByTitle('直前の変更を元に戻す', { exact: true });
		await expect.element(undoButton).toBeEnabled();
		await undoButton.click();

		await vi.waitFor(async () => {
			const restored = (await tasksRepo.list('project-default')).find(
				(task) => task.title === 'Undo確認'
			);
			expect(restored).toMatchObject({
				startDate: '2026-03-10',
				endDate: '2026-03-12'
			});
		});
		await expect.element(undoButton).toBeDisabled();
	});

	it('should cancel a pending import when unknown assignees are detected', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
		await renderPage();

		const input = queryInput('#gantt-import-file');
		const file = new File(
			[
				[
					'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
					',保留取込,2026-03-20,2026-03-21,0,新規担当者,,'
				].join('\n')
			],
			'pending.csv',
			{ type: 'text/csv' }
		);
		Object.defineProperty(input, 'files', {
			value: [file],
			configurable: true
		});
		input.dispatchEvent(new Event('change', { bubbles: true }));

		await expect.element(page.getByText('未登録担当者が見つかりました (1 名)')).toBeInTheDocument();
		await expect.element(page.getByText('新規担当者')).toBeInTheDocument();

		await page.getByRole('button', { name: 'キャンセル' }).click();

		await expect
			.element(page.getByText('未登録担当者が見つかりました (1 名)'))
			.not.toBeInTheDocument();
		await expect.element(page.getByText('取り込みをキャンセルしました。')).toBeInTheDocument();
	});

	it('should create missing users and continue importing tasks', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
		await renderPage();

		const input = queryInput('#gantt-import-file');
		const file = new File(
			[
				[
					'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
					',継続取込,2026-03-22,2026-03-24,10,新規担当者B,,取込メモ'
				].join('\n')
			],
			'continue.csv',
			{ type: 'text/csv' }
		);
		Object.defineProperty(input, 'files', {
			value: [file],
			configurable: true
		});
		input.dispatchEvent(new Event('change', { bubbles: true }));

		await expect.element(page.getByText('未登録担当者が見つかりました (1 名)')).toBeInTheDocument();
		await page.getByRole('button', { name: '不足ユーザーを作成して続行' }).click();

		await expect.element(page.getByTitle('継続取込', { exact: true })).toBeInTheDocument();
		await expect
			.element(page.getByText('1 件のタスクを取り込みました。1 名のユーザーを作成しました。'))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('未登録担当者が見つかりました (1 名)'))
			.not.toBeInTheDocument();

		const users = await tasksRepo.listUsers();
		const members = await tasksRepo.listProjectMembers('project-default');
		expect(users.some((user) => user.name === '新規担当者B')).toBe(true);
		expect(members.some((user) => user.name === '新規担当者B')).toBe(true);
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
