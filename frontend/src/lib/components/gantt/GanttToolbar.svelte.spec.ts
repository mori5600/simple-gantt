import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Project } from '$lib/data/tasks/repo';
import GanttToolbar from './GanttToolbar.svelte';

const projects: Project[] = [
	{ id: 'project-1', name: 'Project 1', sortOrder: 0, updatedAt: '2026-03-01T00:00:00.000Z' },
	{ id: 'project-2', name: 'Project 2', sortOrder: 1, updatedAt: '2026-03-01T00:00:00.000Z' }
];

function renderToolbar(
	props: Partial<{
		zoom: 'day' | 'week' | 'month';
		projects: readonly Project[];
		selectedProjectId: string;
		isListColumnAuto: boolean;
		hasSelectedTask: boolean;
		importDisabled: boolean;
		isImporting: boolean;
		exportDisabled: boolean;
		isExporting: boolean;
		hasUndoableChange: boolean;
		isUndoing: boolean;
		onProjectChange: (projectId: string) => void;
		onCreate: () => void;
		onEdit: () => void;
		onDelete: () => void;
		onJumpToToday: () => void;
		onAutoFit: () => void;
		onUndo: () => void;
		onImport: (file: File) => void;
		onExport: (format: 'csv' | 'xlsx') => void;
		onZoomChange: (zoom: 'day' | 'week' | 'month') => void;
	}> = {}
) {
	return render(GanttToolbar, {
		props: {
			zoom: 'day',
			projects,
			selectedProjectId: 'project-1',
			isListColumnAuto: false,
			hasSelectedTask: true,
			importDisabled: false,
			isImporting: false,
			exportDisabled: false,
			isExporting: false,
			hasUndoableChange: false,
			isUndoing: false,
			onProjectChange: vi.fn(),
			onCreate: vi.fn(),
			onEdit: vi.fn(),
			onDelete: vi.fn(),
			onJumpToToday: vi.fn(),
			onAutoFit: vi.fn(),
			onUndo: vi.fn(),
			onImport: vi.fn(),
			onExport: vi.fn(),
			onZoomChange: vi.fn(),
			...props
		}
	});
}

describe('GanttToolbar.svelte', () => {
	it('should fire project and toolbar action callbacks', async () => {
		const onProjectChange = vi.fn();
		const onCreate = vi.fn();
		const onEdit = vi.fn();
		const onDelete = vi.fn();
		const onJumpToToday = vi.fn();
		const onAutoFit = vi.fn();
		const onUndo = vi.fn();
		const onZoomChange = vi.fn();

		renderToolbar({
			onProjectChange,
			onCreate,
			onEdit,
			onDelete,
			onJumpToToday,
			onAutoFit,
			onUndo,
			hasUndoableChange: true,
			onZoomChange
		});

		await page.getByRole('combobox', { name: 'Project' }).selectOptions('project-2');
		await page.getByRole('button', { name: 'タスク追加' }).click();
		await page.getByRole('button', { name: '編集' }).click();
		await page.getByRole('button', { name: '削除' }).click();
		await page.getByRole('button', { name: '今日' }).click();
		await page.getByRole('button', { name: 'Auto Fit' }).click();
		await page.getByRole('button', { name: 'Undo' }).click();
		await page.getByRole('button', { name: 'Month' }).click();

		expect(onProjectChange).toHaveBeenCalledWith('project-2');
		expect(onCreate).toHaveBeenCalledOnce();
		expect(onEdit).toHaveBeenCalledOnce();
		expect(onDelete).toHaveBeenCalledOnce();
		expect(onJumpToToday).toHaveBeenCalledOnce();
		expect(onAutoFit).toHaveBeenCalledOnce();
		expect(onUndo).toHaveBeenCalledOnce();
		expect(onZoomChange).toHaveBeenCalledWith('month');
	});

	it('should disable guarded buttons when project or task selection is unavailable', async () => {
		renderToolbar({
			projects: [],
			selectedProjectId: '',
			hasSelectedTask: false,
			exportDisabled: true,
			importDisabled: true
		});

		await expect.element(page.getByRole('button', { name: 'タスク追加' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: '編集' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: '削除' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: '取込' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: '出力' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
	});

	it('should open export menu, emit selected format, and close on outside click', async () => {
		const onExport = vi.fn();

		renderToolbar({
			onExport
		});

		await page.getByRole('button', { name: '出力' }).click();
		await expect.element(page.getByRole('button', { name: 'CSV' })).toBeInTheDocument();
		await page.getByRole('button', { name: 'CSV' }).click();

		expect(onExport).toHaveBeenCalledWith('csv');
		await expect.element(page.getByRole('button', { name: 'CSV' })).not.toBeInTheDocument();

		await page.getByRole('button', { name: '出力' }).click();
		document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await expect.element(page.getByRole('button', { name: 'CSV' })).not.toBeInTheDocument();
	});

	it('should forward imported files and ignore empty file selections', async () => {
		const onImport = vi.fn();
		const view = renderToolbar({
			onImport
		});

		const input = view.container.querySelector('#gantt-import-file');
		if (!(input instanceof HTMLInputElement)) {
			throw new Error('expected hidden file input');
		}

		const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});
		await page.getByRole('button', { name: '取込', exact: true }).click();
		expect(clickSpy).toHaveBeenCalledOnce();

		const file = new File(['id,title'], 'tasks.csv', { type: 'text/csv' });
		Object.defineProperty(input, 'files', {
			value: [file],
			configurable: true
		});
		input.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onImport).toHaveBeenCalledWith(file);

		Object.defineProperty(input, 'files', {
			value: [],
			configurable: true
		});
		input.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onImport).toHaveBeenCalledTimes(1);
	});
});
