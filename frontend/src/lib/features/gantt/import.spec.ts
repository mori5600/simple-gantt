import { describe, expect, it, vi } from 'vitest';
import type { User } from '$lib/data/tasks/repo';
import {
	planTaskImportDrafts,
	parseTaskImportFile,
	TaskImportContractError,
	parseTaskImportCsv,
	parseTaskImportSheetData,
	toTaskImportDrafts
} from './import';

const xlsxMocks = vi.hoisted(() => ({
	read: vi.fn(),
	sheetToJson: vi.fn()
}));

vi.mock('xlsx', () => ({
	read: xlsxMocks.read,
	utils: {
		sheet_to_json: xlsxMocks.sheetToJson
	}
}));

const users: User[] = [
	{ id: 'user-1', name: '伊藤', updatedAt: '2026-02-20T00:00:00.000Z' },
	{ id: 'user-2', name: '佐藤', updatedAt: '2026-02-20T00:00:00.000Z' }
];

describe('task import helpers', () => {
	it('parseTaskImportCsv should parse UTF-8 BOM and escaped csv cells', () => {
		const csv = [
			'\uFEFFタスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
			'task-1,要件確認,2026-02-20,2026-02-21,40,"伊藤, 佐藤",,"相談, ""要確認"""',
			'task-2,実装,2026-02-22,2026-02-23,20,未割り当て,task-1,'
		].join('\r\n');

		const rows = parseTaskImportCsv(csv);
		expect(rows).toEqual([
			{
				rowNumber: 2,
				taskId: 'task-1',
				title: '要件確認',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: '40',
				assignees: '伊藤, 佐藤',
				predecessorTaskId: '',
				note: '相談, "要確認"'
			},
			{
				rowNumber: 3,
				taskId: 'task-2',
				title: '実装',
				startDate: '2026-02-22',
				endDate: '2026-02-23',
				progress: '20',
				assignees: '未割り当て',
				predecessorTaskId: 'task-1',
				note: ''
			}
		]);
	});

	it('parseTaskImportSheetData should parse header aliases with key names', () => {
		const rows = parseTaskImportSheetData([
			[
				'taskId',
				'title',
				'startDate',
				'endDate',
				'progress',
				'assignees',
				'predecessorTaskId',
				'note'
			],
			['task-10', '実装', '2026-03-01', '2026-03-05', 70, '伊藤', '', '作業中']
		]);

		expect(rows).toEqual([
			{
				rowNumber: 2,
				taskId: 'task-10',
				title: '実装',
				startDate: '2026-03-01',
				endDate: '2026-03-05',
				progress: '70',
				assignees: '伊藤',
				predecessorTaskId: '',
				note: '作業中'
			}
		]);
	});

	it('parseTaskImportSheetData should skip empty rows and fill missing optional columns', () => {
		const rows = parseTaskImportSheetData([
			['タイトル', '開始日', '終了日', '進捗(%)'],
			[],
			[' 実装 ', '2026-03-01', '2026-03-05', 70, null],
			[undefined, undefined, undefined, undefined]
		]);

		expect(rows).toEqual([
			{
				rowNumber: 3,
				taskId: '',
				title: '実装',
				startDate: '2026-03-01',
				endDate: '2026-03-05',
				progress: '70',
				assignees: '',
				predecessorTaskId: '',
				note: ''
			}
		]);
	});

	it('toTaskImportDrafts should map assignee names and validate predecessor references', () => {
		const rows = parseTaskImportCsv(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,伊藤,,',
				'task-2,実装,2026-02-22,2026-02-23,20,佐藤,task-1,'
			].join('\n')
		);

		const drafts = toTaskImportDrafts({
			rows,
			users,
			existingTaskIds: new Set<string>(['existing-task'])
		});

		expect(drafts).toEqual([
			{
				sourceTaskId: 'task-1',
				predecessorSourceTaskId: null,
				createInput: {
					title: '要件確認',
					startDate: '2026-02-20',
					endDate: '2026-02-21',
					progress: 40,
					note: '',
					assigneeIds: ['user-1'],
					predecessorTaskId: null
				}
			},
			{
				sourceTaskId: 'task-2',
				predecessorSourceTaskId: 'task-1',
				createInput: {
					title: '実装',
					startDate: '2026-02-22',
					endDate: '2026-02-23',
					progress: 20,
					note: '',
					assigneeIds: ['user-2'],
					predecessorTaskId: null
				}
			}
		]);
	});

	it('toTaskImportDrafts should fail fast on unknown assignee names', () => {
		const rows = parseTaskImportCsv(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,伊藤,,',
				'task-2,実装,2026-02-22,2026-02-23,20,未知ユーザー,,'
			].join('\n')
		);

		expect(() =>
			toTaskImportDrafts({
				rows,
				users,
				existingTaskIds: new Set<string>()
			})
		).toThrowError(TaskImportContractError);
	});

	it('planTaskImportDrafts should return missing assignees when allow mode is enabled', () => {
		const rows = parseTaskImportCsv(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,伊藤,,',
				'task-2,実装,2026-02-22,2026-02-23,20,新規ユーザーA,task-1,',
				'task-3,検証,2026-02-24,2026-02-24,0,新規ユーザーB,,'
			].join('\n')
		);

		const plan = planTaskImportDrafts({
			rows,
			users,
			existingTaskIds: new Set<string>(),
			allowMissingAssignees: true
		});

		expect(plan).toEqual({
			kind: 'missing_assignees',
			missingAssigneeNames: ['新規ユーザーA', '新規ユーザーB']
		});
	});

	it('helpers should reject missing required headers and dangling predecessor ids', () => {
		expect(() =>
			parseTaskImportCsv(
				[
					'タスクID,タイトル,開始日,終了日,担当者,先行タスクID,メモ',
					'task-1,要件確認,2026-02-20,2026-02-21,伊藤,,'
				].join('\n')
			)
		).toThrowError(TaskImportContractError);

		const rows = parseTaskImportCsv(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,伊藤,missing-task,'
			].join('\n')
		);

		expect(() =>
			toTaskImportDrafts({
				rows,
				users,
				existingTaskIds: new Set<string>()
			})
		).toThrowError(TaskImportContractError);
	});

	it('helpers should reject empty files, unclosed quotes, duplicate ids, self predecessors, and duplicate user names', () => {
		expect(() => parseTaskImportCsv('   ')).toThrowError(TaskImportContractError);
		expect(() =>
			parseTaskImportCsv(
				[
					'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
					'task-1,"要件確認,2026-02-20,2026-02-21,40,伊藤,,'
				].join('\n')
			)
		).toThrowError(TaskImportContractError);

		const duplicateRows = parseTaskImportCsv(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,,,',
				'task-1,実装,2026-02-22,2026-02-23,20,,,'
			].join('\n')
		);
		expect(() =>
			toTaskImportDrafts({
				rows: duplicateRows,
				users,
				existingTaskIds: new Set<string>()
			})
		).toThrowError(TaskImportContractError);

		const selfPredecessorRows = parseTaskImportCsv(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,,task-1,'
			].join('\n')
		);
		expect(() =>
			toTaskImportDrafts({
				rows: selfPredecessorRows,
				users,
				existingTaskIds: new Set<string>()
			})
		).toThrowError(TaskImportContractError);

		expect(() =>
			toTaskImportDrafts({
				rows: parseTaskImportCsv(
					[
						'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
						'task-1,要件確認,2026-02-20,2026-02-21,40,伊藤,,'
					].join('\n')
				),
				users: [...users, { id: 'user-3', name: '伊藤', updatedAt: '2026-02-20T00:00:00.000Z' }],
				existingTaskIds: new Set<string>()
			})
		).toThrowError(TaskImportContractError);
	});

	it('parseTaskImportFile should parse xlsx content and reject unsupported or broken workbooks', async () => {
		xlsxMocks.read.mockReturnValueOnce({
			SheetNames: ['Sheet1'],
			Sheets: {
				Sheet1: { A1: 'dummy' }
			}
		});
		xlsxMocks.sheetToJson.mockReturnValueOnce([
			['タイトル', '開始日', '終了日', '進捗(%)'],
			['実装', '2026-03-01', '2026-03-05', 70]
		]);

		const parsed = await parseTaskImportFile(
			new File(['dummy'], 'tasks.xlsx', {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			})
		);
		expect(parsed).toEqual([
			{
				rowNumber: 2,
				taskId: '',
				title: '実装',
				startDate: '2026-03-01',
				endDate: '2026-03-05',
				progress: '70',
				assignees: '',
				predecessorTaskId: '',
				note: ''
			}
		]);

		xlsxMocks.read.mockReturnValueOnce({
			SheetNames: [],
			Sheets: {}
		});
		await expect(
			parseTaskImportFile(
				new File(['dummy'], 'broken.xlsx', {
					type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
				})
			)
		).rejects.toThrow(TaskImportContractError);

		xlsxMocks.read.mockReturnValueOnce({
			SheetNames: ['Sheet1'],
			Sheets: {}
		});
		await expect(
			parseTaskImportFile(
				new File(['dummy'], 'missing-sheet.xlsx', {
					type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
				})
			)
		).rejects.toThrow(TaskImportContractError);

		await expect(parseTaskImportFile(new File(['{}'], 'tasks.json'))).rejects.toThrow(
			TaskImportContractError
		);
	});
});
