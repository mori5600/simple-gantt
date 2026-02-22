import { describe, expect, it } from 'vitest';
import type { Task, User } from '$lib/tasksRepo';
import {
	buildTaskExportFileBaseName,
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

describe('task export helpers', () => {
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
});
