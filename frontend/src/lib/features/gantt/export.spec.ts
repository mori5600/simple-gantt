import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task, User } from '$lib/data/tasks/repo';
const xlsxMock = vi.hoisted(() => ({
	utils: {
		book_new: vi.fn(() => ({ sheets: [] })),
		aoa_to_sheet: vi.fn((rows: unknown[][]) => ({ rows })),
		book_append_sheet: vi.fn()
	},
	write: vi.fn(() => new Uint8Array([1, 2, 3]))
}));

vi.mock('xlsx', () => xlsxMock);

import {
	buildTaskExportFileBaseName,
	exportTasksAsCsv,
	exportTasksAsXlsx,
	toTaskExportCsv,
	toTaskExportRows,
	toTaskExportSheetData
} from './export';

const users: User[] = [
	{ id: 'user-1', name: '伊藤', updatedAt: '2026-02-20T00:00:00.000Z' },
	{ id: 'user-2', name: '佐藤', updatedAt: '2026-02-20T00:00:00.000Z' }
];

const tasks: Task[] = [
	{
		id: 'task-1',
		projectId: 'project-1',
		title: '要件確認',
		note: '相談, "要確認"',
		startDate: '2026-02-20',
		endDate: '2026-02-21',
		progress: 40,
		sortOrder: 0,
		updatedAt: '2026-02-20T09:00:00.000Z',
		assigneeIds: ['user-1', 'user-missing'],
		predecessorTaskId: null
	},
	{
		id: 'task-2',
		projectId: 'project-1',
		title: '実装',
		note: '',
		startDate: '2026-02-22',
		endDate: '2026-02-23',
		progress: 20,
		sortOrder: 1,
		updatedAt: '2026-02-20T10:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: 'task-1'
	}
];

function createDownloadHarness() {
	const anchor = {
		href: '',
		download: '',
		style: {
			display: ''
		},
		click: vi.fn(),
		remove: vi.fn()
	};
	const append = vi.fn();
	const createElement = vi.fn(() => anchor);
	const createObjectURL = vi.fn((blob: Blob) => {
		void blob;
		return 'blob:test';
	});
	const revokeObjectURL = vi.fn();

	vi.stubGlobal('document', {
		createElement,
		body: { append }
	});
	vi.stubGlobal('URL', {
		createObjectURL,
		revokeObjectURL
	});

	return {
		anchor,
		append,
		createElement,
		createObjectURL,
		revokeObjectURL
	};
}

describe('task export helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('toTaskExportRows should resolve assignee names and predecessor title', () => {
		const rows = toTaskExportRows({
			projectId: 'project-1',
			projectName: 'Simple Project',
			tasks,
			users
		});

		expect(rows).toEqual([
			{
				projectId: 'project-1',
				projectName: 'Simple Project',
				taskId: 'task-1',
				title: '要件確認',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 40,
				assignees: '伊藤, user-missing',
				predecessorTaskId: '',
				predecessorTaskTitle: '',
				note: '相談, "要確認"',
				updatedAt: '2026-02-20T09:00:00.000Z'
			},
			{
				projectId: 'project-1',
				projectName: 'Simple Project',
				taskId: 'task-2',
				title: '実装',
				startDate: '2026-02-22',
				endDate: '2026-02-23',
				progress: 20,
				assignees: '未割り当て',
				predecessorTaskId: 'task-1',
				predecessorTaskTitle: '要件確認',
				note: '',
				updatedAt: '2026-02-20T10:00:00.000Z'
			}
		]);
	});

	it('toTaskExportCsv should include UTF-8 BOM and escape CSV values', () => {
		const rows = toTaskExportRows({
			projectId: 'project-1',
			projectName: 'Simple Project',
			tasks,
			users
		});
		const csv = toTaskExportCsv(rows);

		expect(csv.startsWith('\uFEFF')).toBe(true);
		expect(csv).toContain('"相談, ""要確認"""');
		expect(csv).toContain('進捗(%)');
	});

	it('helpers should build deterministic sheet rows and filename', () => {
		const rows = toTaskExportRows({
			projectId: 'project-1',
			projectName: 'Simple Project',
			tasks,
			users
		});
		const sheetData = toTaskExportSheetData(rows);

		expect(sheetData[0]).toEqual([
			'プロジェクトID',
			'プロジェクト名',
			'タスクID',
			'タイトル',
			'開始日',
			'終了日',
			'進捗(%)',
			'担当者',
			'先行タスクID',
			'先行タスク名',
			'メモ',
			'更新日時'
		]);
		expect(sheetData[1]?.[3]).toBe('要件確認');
		expect(sheetData[2]?.[9]).toBe('要件確認');

		const fileBaseName = buildTaskExportFileBaseName(
			'  /営業:*?案件  ',
			new Date(2026, 1, 22, 1, 2, 3)
		);
		expect(fileBaseName).toBe('tasks-営業-案件-20260222-010203');
	});

	it('exportTasksAsCsv should trigger a browser download with csv content', async () => {
		const downloadHarness = createDownloadHarness();
		const filename = exportTasksAsCsv(
			{
				projectId: 'project-1',
				projectName: 'Simple Project',
				tasks,
				users
			},
			new Date(2026, 1, 22, 1, 2, 3)
		);

		expect(filename).toBe('tasks-Simple_Project-20260222-010203.csv');
		expect(downloadHarness.createElement).toHaveBeenCalledWith('a');
		expect(downloadHarness.anchor.download).toBe(filename);
		expect(downloadHarness.anchor.href).toBe('blob:test');
		expect(downloadHarness.append).toHaveBeenCalledWith(downloadHarness.anchor);
		expect(downloadHarness.anchor.click).toHaveBeenCalledOnce();
		expect(downloadHarness.anchor.remove).toHaveBeenCalledOnce();
		expect(downloadHarness.revokeObjectURL).toHaveBeenCalledWith('blob:test');
		const csvBlob = downloadHarness.createObjectURL.mock.calls.at(0)?.[0];
		expect(csvBlob).toBeInstanceOf(Blob);
		if (!(csvBlob instanceof Blob)) {
			throw new Error('expected csv export to create a Blob');
		}
		expect(csvBlob.type).toBe('text/csv;charset=utf-8');
		await expect(csvBlob.text()).resolves.toContain('進捗(%)');
	});

	it('exportTasksAsXlsx should build a workbook and trigger a spreadsheet download', async () => {
		const downloadHarness = createDownloadHarness();

		const filename = await exportTasksAsXlsx(
			{
				projectId: 'project-1',
				projectName: 'Simple Project',
				tasks,
				users
			},
			new Date(2026, 1, 22, 1, 2, 3)
		);

		expect(filename).toBe('tasks-Simple_Project-20260222-010203.xlsx');
		expect(xlsxMock.utils.book_new).toHaveBeenCalledOnce();
		expect(xlsxMock.utils.aoa_to_sheet).toHaveBeenCalledOnce();
		expect(xlsxMock.utils.book_append_sheet).toHaveBeenCalledWith(
			{ sheets: [] },
			expect.objectContaining({ rows: expect.any(Array) }),
			'Tasks'
		);
		expect(xlsxMock.write).toHaveBeenCalledWith(
			{ sheets: [] },
			{ type: 'array', bookType: 'xlsx' }
		);
		const xlsxBlob = downloadHarness.createObjectURL.mock.calls.at(0)?.[0];
		expect(xlsxBlob).toBeInstanceOf(Blob);
		if (!(xlsxBlob instanceof Blob)) {
			throw new Error('expected xlsx export to create a Blob');
		}
		expect(xlsxBlob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		expect(downloadHarness.anchor.download).toBe(filename);
		expect(downloadHarness.anchor.click).toHaveBeenCalledOnce();
	});

	it('exportTasksAsCsv should fail outside the browser environment', () => {
		vi.stubGlobal('document', undefined);

		expect(() =>
			exportTasksAsCsv({
				projectId: 'project-1',
				projectName: 'Simple Project',
				tasks,
				users
			})
		).toThrow('ダウンロードはブラウザでのみ利用できます。');
	});
});
