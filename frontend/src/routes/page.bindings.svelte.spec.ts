import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { Task } from '$lib/data/tasks/repo';

type LifecycleParams = {
	refreshProject: (projectId: string) => Promise<unknown>;
	getSyncState: () => {
		selectedProjectId: string;
		isSubmitting: boolean;
		isInitialized: boolean;
	};
	onTaskFiltersRestored: (filters: {
		query: string;
		assignee: string;
		status: 'all' | 'complete' | 'incomplete';
		rangeStart: string;
		rangeEnd: string;
	}) => void;
	onStorageReady: () => void;
	onTasks: (tasks: Task[]) => void;
	onProjects: (
		projects: Array<{ id: string; name: string; sortOrder: number; updatedAt: string }>
	) => void;
	onUsers: (users: Array<{ id: string; name: string; updatedAt: string }>) => void;
	onProjectMembers: (users: Array<{ id: string; name: string; updatedAt: string }>) => void;
	onSyncError: (message: string) => void;
	onInitializeSuccess: (projectId: string) => void;
	onInitializeError: (message: string) => void;
};

type EffectsParams = {
	state: {
		read: () => {
			taskFilters: {
				query: string;
				assignee: string;
				status: string;
				rangeStart: string;
				rangeEnd: string;
			};
			taskDatePreviews: Record<string, { startDate: string; endDate: string }>;
		};
		setTaskFilters: (filters: {
			query: string;
			assignee: string;
			status: 'all' | 'complete' | 'incomplete';
			rangeStart: string;
			rangeEnd: string;
		}) => void;
		setTaskDatePreviews: (previews: Record<string, { startDate: string; endDate: string }>) => void;
	};
};

type HandlerState = {
	setIsExporting: (value: boolean) => void;
	setUndoAction: (value: { previousTask: Task; appliedUpdatedAt: string } | null) => void;
};

const harness = vi.hoisted(() => {
	const refresh = vi.fn(async () => undefined);
	const handlers = {
		changeProject: vi.fn(async () => undefined),
		exportTasks: vi.fn(async () => undefined),
		importTasks: vi.fn(async () => undefined),
		cancelPendingImport: vi.fn(),
		createMissingUsersAndContinue: vi.fn(async () => undefined),
		reorderTasks: vi.fn(async () => undefined),
		openCreateModal: vi.fn(),
		openTaskEditPage: vi.fn(() => undefined),
		submitTask: vi.fn(async () => undefined),
		deleteSelectedTask: vi.fn(async () => undefined),
		commitTaskDateRange: vi.fn(async () => undefined),
		undoLastChange: vi.fn(async () => undefined),
		toggleFormAssignee: vi.fn(() => undefined),
		setTaskDatePreview: vi.fn(() => undefined),
		clearTaskDatePreview: vi.fn(() => undefined)
	};

	return {
		refresh,
		handlers,
		lifecycleParams: undefined as LifecycleParams | undefined,
		effectsParams: undefined as EffectsParams | undefined,
		handlerState: undefined as HandlerState | undefined,
		reset() {
			this.lifecycleParams = undefined;
			this.effectsParams = undefined;
			this.handlerState = undefined;
			this.refresh.mockClear();
			for (const fn of Object.values(this.handlers)) {
				fn.mockClear();
			}
		}
	};
});

vi.mock('$lib/stores/tasksStore', () => ({
	tasksStore: {
		refresh: harness.refresh
	}
}));

vi.mock('$lib/features/gantt/lifecycle', () => ({
	mountGanttPageLifecycle: vi.fn((params: LifecycleParams) => {
		harness.lifecycleParams = params;
		return vi.fn();
	})
}));

vi.mock('$lib/features/gantt/pageEffects', () => ({
	createGanttPageEffects: vi.fn((params: EffectsParams) => {
		harness.effectsParams = params;
		return {
			syncSelectedTask: () => {},
			syncAutoListColumns: () => {},
			persistTaskFilters: () => {},
			persistSelectedProject: () => {},
			sanitizeAssigneeFilter: () => {},
			trimTaskDatePreviews: () => {}
		};
	})
}));

vi.mock('$lib/features/gantt/pageHandlers', () => ({
	createGanttPageHandlers: vi.fn((params: { state: HandlerState }) => {
		harness.handlerState = params.state;
		return harness.handlers;
	})
}));

import Page from './+page.svelte';

function projectFixture() {
	return {
		id: 'project-1',
		name: 'Project 1',
		sortOrder: 0,
		updatedAt: '2026-03-01T00:00:00.000Z'
	};
}

function userFixture() {
	return {
		id: 'user-1',
		name: '伊藤',
		updatedAt: '2026-03-01T00:00:00.000Z'
	};
}

function taskFixture(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		projectId: 'project-1',
		title: '要件確認',
		note: '',
		startDate: '2026-03-01',
		endDate: '2026-03-03',
		progress: 20,
		sortOrder: 0,
		updatedAt: '2026-03-01T00:00:00.000Z',
		assigneeIds: ['user-1'],
		predecessorTaskId: null,
		...overrides
	};
}

async function renderPageWithHarness(): Promise<void> {
	harness.reset();
	render(Page);
	await expect.element(page.getByRole('combobox', { name: 'Project' })).toBeInTheDocument();
	if (!harness.lifecycleParams || !harness.effectsParams || !harness.handlerState) {
		throw new Error('expected page harness to capture params');
	}
}

function seedPageState(): void {
	if (!harness.lifecycleParams) {
		throw new Error('expected lifecycle params');
	}
	harness.lifecycleParams.onProjects([projectFixture()]);
	harness.lifecycleParams.onUsers([userFixture()]);
	harness.lifecycleParams.onProjectMembers([userFixture()]);
	harness.lifecycleParams.onTasks([
		taskFixture(),
		taskFixture({
			id: 'task-2',
			title: '実装',
			startDate: '2026-03-04',
			endDate: '2026-03-06',
			sortOrder: 1,
			updatedAt: '2026-03-02T00:00:00.000Z'
		})
	]);
	harness.lifecycleParams.onStorageReady();
	harness.lifecycleParams.onInitializeSuccess('project-1');
}

describe('/+page.svelte bindings', () => {
	it('should wire lifecycle callbacks and page effect state setters', async () => {
		await renderPageWithHarness();

		await harness.lifecycleParams?.refreshProject('project-1');
		expect(harness.refresh).toHaveBeenCalledWith('project-1');
		expect(harness.lifecycleParams?.getSyncState()).toEqual({
			selectedProjectId: '',
			isSubmitting: false,
			isInitialized: false
		});

		harness.lifecycleParams?.onTaskFiltersRestored({
			query: '復元',
			assignee: '',
			status: 'all',
			rangeStart: '',
			rangeEnd: ''
		});
		await expect.element(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('復元');

		harness.effectsParams?.state.setTaskFilters({
			query: 'effects',
			assignee: '',
			status: 'all',
			rangeStart: '',
			rangeEnd: ''
		});
		await expect.element(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('effects');

		harness.effectsParams?.state.setTaskDatePreviews({
			'task-1': {
				startDate: '2026-03-10',
				endDate: '2026-03-12'
			}
		});
		expect(harness.effectsParams?.state.read().taskDatePreviews).toEqual({
			'task-1': {
				startDate: '2026-03-10',
				endDate: '2026-03-12'
			}
		});

		harness.lifecycleParams?.onSyncError('sync failed');
		await expect.element(page.getByText('sync failed')).toBeInTheDocument();

		harness.lifecycleParams?.onInitializeError('init failed');
		await expect.element(page.getByText('init failed')).toBeInTheDocument();
		expect(harness.lifecycleParams?.getSyncState()).toEqual({
			selectedProjectId: '',
			isSubmitting: false,
			isInitialized: true
		});
	});

	it('should wire toolbar, list, and timeline events into page handlers', async () => {
		await renderPageWithHarness();
		seedPageState();

		await expect.element(page.getByTitle('要件確認', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByTitle('実装', { exact: true })).toBeInTheDocument();

		harness.handlerState?.setIsExporting(true);
		await expect.element(page.getByRole('button', { name: '出力' })).toBeDisabled();
		harness.handlerState?.setIsExporting(false);
		await expect.element(page.getByRole('button', { name: '出力' })).toBeEnabled();
		await expect.element(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

		harness.handlerState?.setUndoAction({
			previousTask: taskFixture(),
			appliedUpdatedAt: '2026-03-02T00:00:00.000Z'
		});
		await expect.element(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
		await page.getByRole('button', { name: 'Undo' }).click();
		expect(harness.handlers.undoLastChange).toHaveBeenCalledTimes(1);

		await page.getByRole('button', { name: '編集' }).click();
		expect(harness.handlers.openTaskEditPage).toHaveBeenCalledTimes(1);
		harness.handlers.openTaskEditPage.mockClear();

		await page.getByRole('button', { name: '出力' }).click();
		await page.getByRole('button', { name: 'CSV' }).click();
		expect(harness.handlers.exportTasks).toHaveBeenCalledWith('csv');

		const listRows = [...document.querySelectorAll('button[draggable="true"]')];
		const firstListRow = listRows[0];
		const secondListRow = listRows[1];
		if (
			!(firstListRow instanceof HTMLButtonElement) ||
			!(secondListRow instanceof HTMLButtonElement)
		) {
			throw new Error('expected draggable list rows');
		}

		secondListRow.click();
		await vi.waitFor(() => {
			expect(secondListRow.className).toContain('bg-sky-50/70');
		});

		secondListRow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(harness.handlers.openTaskEditPage).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'task-2', title: '実装' })
		);

		const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
		Object.defineProperty(dragStartEvent, 'dataTransfer', {
			value: {
				effectAllowed: '',
				setData: vi.fn()
			}
		});
		firstListRow.dispatchEvent(dragStartEvent);

		const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
		Object.defineProperty(dragOverEvent, 'dataTransfer', {
			value: {
				dropEffect: ''
			}
		});
		secondListRow.dispatchEvent(dragOverEvent);
		secondListRow.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
		firstListRow.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
		expect(harness.handlers.reorderTasks).toHaveBeenCalledWith('task-1', 'task-2');

		harness.handlers.openTaskEditPage.mockClear();
		const timelineTask = [...document.querySelectorAll('button[title]')].find((element) =>
			element.getAttribute('title')?.startsWith('要件確認 / 担当: 伊藤')
		);
		if (!(timelineTask instanceof HTMLButtonElement)) {
			throw new Error('expected timeline task');
		}
		timelineTask.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(harness.handlers.openTaskEditPage).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'task-1', title: '要件確認' })
		);
	});
});
