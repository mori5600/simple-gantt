import { describe, expect, it, vi } from 'vitest';
import type { Task, User } from '$lib/data/tasks/repo';
import { parseTaskImportCsv } from './import';

const exportMocks = vi.hoisted(() => {
	return {
		exportTasksAsCsv: vi.fn(),
		exportTasksAsXlsx: vi.fn()
	};
});

vi.mock('./export', () => {
	return {
		exportTasksAsCsv: exportMocks.exportTasksAsCsv,
		exportTasksAsXlsx: exportMocks.exportTasksAsXlsx
	};
});

import {
	mergeUsersById,
	runCommitTaskDateRangeWorkflow,
	runDeleteSelectedTaskWorkflow,
	runDeleteTaskWorkflow,
	runTaskExportWorkflow,
	runPrepareTaskImportWorkflow,
	runReorderTasksWorkflow,
	runResolveMissingAssigneesWorkflow,
	runSubmitTaskWorkflow,
	runTaskActionWorkflow,
	runTaskImportWorkflow
} from './actionWorkflows';

function userFixture(partial: Partial<User> = {}): User {
	return {
		id: 'user-1',
		name: '伊藤',
		updatedAt: '2026-02-20T00:00:00.000Z',
		...partial
	};
}

function taskFixture(partial: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		projectId: 'project-1',
		title: '設計',
		note: '',
		startDate: '2026-02-20',
		endDate: '2026-02-21',
		progress: 10,
		sortOrder: 0,
		updatedAt: '2026-02-20T00:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: null,
		...partial
	};
}

function csvFile(text: string, name = 'tasks.csv'): File {
	return new File([text], name, { type: 'text/csv' });
}

describe('actionWorkflows', () => {
	it('runTaskExportWorkflow should validate export preconditions', async () => {
		await expect(
			runTaskExportWorkflow({
				format: 'csv',
				projectId: '',
				projectName: 'P1',
				tasks: [taskFixture()],
				users: [userFixture()],
				isBrowser: true
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'プロジェクトを選択してください。'
		});

		await expect(
			runTaskExportWorkflow({
				format: 'xlsx',
				projectId: 'project-1',
				projectName: 'P1',
				tasks: [],
				users: [userFixture()],
				isBrowser: true
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: '出力対象のタスクがありません。'
		});
	});

	it('runTaskExportWorkflow should skip on non-browser and call exporters on browser', async () => {
		exportMocks.exportTasksAsCsv.mockReset();
		exportMocks.exportTasksAsXlsx.mockReset();
		exportMocks.exportTasksAsXlsx.mockResolvedValue('tasks.xlsx');

		await expect(
			runTaskExportWorkflow({
				format: 'csv',
				projectId: 'project-1',
				projectName: 'プロジェクトA',
				tasks: [taskFixture()],
				users: [userFixture()],
				isBrowser: false
			})
		).resolves.toEqual({
			kind: 'noop'
		});
		expect(exportMocks.exportTasksAsCsv).not.toHaveBeenCalled();

		await expect(
			runTaskExportWorkflow({
				format: 'csv',
				projectId: 'project-1',
				projectName: 'プロジェクトA',
				tasks: [taskFixture()],
				users: [userFixture()],
				isBrowser: true
			})
		).resolves.toEqual({
			kind: 'ok'
		});
		expect(exportMocks.exportTasksAsCsv).toHaveBeenCalledTimes(1);

		await expect(
			runTaskExportWorkflow({
				format: 'xlsx',
				projectId: 'project-1',
				projectName: 'プロジェクトA',
				tasks: [taskFixture()],
				users: [userFixture()],
				isBrowser: true
			})
		).resolves.toEqual({
			kind: 'ok'
		});
		expect(exportMocks.exportTasksAsXlsx).toHaveBeenCalledTimes(1);
	});

	it('runSubmitTaskWorkflow should return validation error when project is missing', async () => {
		const store = {
			create: vi.fn(),
			update: vi.fn()
		};

		const result = await runSubmitTaskWorkflow({
			store,
			mode: 'create',
			projectId: '',
			taskForm: {
				title: '新規タスク',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: ''
			},
			editingTaskId: null,
			sourceTask: null
		});

		expect(result).toEqual({
			kind: 'error',
			formError: 'プロジェクトを選択してください。'
		});
	});

	it('runSubmitTaskWorkflow should create task when input is valid', async () => {
		const store = {
			create: vi.fn().mockResolvedValue(taskFixture({ id: 'task-created' })),
			update: vi.fn()
		};

		const result = await runSubmitTaskWorkflow({
			store,
			mode: 'create',
			projectId: 'project-1',
			taskForm: {
				title: '新規タスク',
				note: 'note',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 20,
				assigneeIds: ['user-1'],
				predecessorTaskId: ''
			},
			editingTaskId: null,
			sourceTask: null
		});

		expect(result).toEqual({
			kind: 'ok',
			selectedTaskId: 'task-created'
		});
		expect(store.create).toHaveBeenCalledTimes(1);
	});

	it('runSubmitTaskWorkflow should surface validation and submit action errors', async () => {
		const store = {
			create: vi.fn(),
			update: vi.fn()
		};

		await expect(
			runSubmitTaskWorkflow({
				store,
				mode: 'create',
				projectId: 'project-1',
				taskForm: {
					title: '新規タスク',
					note: '',
					startDate: '2026-02-22',
					endDate: '2026-02-21',
					progress: 10,
					assigneeIds: [],
					predecessorTaskId: ''
				},
				editingTaskId: null,
				sourceTask: null
			})
		).resolves.toEqual({
			kind: 'error',
			formError: '開始日は終了日以前にしてください。'
		});

		await expect(
			runSubmitTaskWorkflow({
				store,
				mode: 'edit',
				projectId: 'project-1',
				taskForm: {
					title: '更新',
					note: '',
					startDate: '2026-02-20',
					endDate: '2026-02-21',
					progress: 10,
					assigneeIds: [],
					predecessorTaskId: ''
				},
				editingTaskId: null,
				sourceTask: null
			})
		).resolves.toEqual({
			kind: 'error',
			formError: '編集対象のタスクが見つかりません。'
		});
	});

	it('runTaskActionWorkflow should map success and error results to feedback', async () => {
		await expect(runTaskActionWorkflow(async () => null)).resolves.toEqual({
			kind: 'ok',
			actionError: '',
			actionSuccess: ''
		});
		await expect(runTaskActionWorkflow(async () => '失敗')).resolves.toEqual({
			kind: 'error',
			actionError: '失敗',
			actionSuccess: ''
		});
	});

	it('runDeleteTaskWorkflow and runCommitTaskDateRangeWorkflow should validate projectId first', async () => {
		const store = {
			remove: vi.fn(),
			update: vi.fn()
		};

		await expect(
			runDeleteTaskWorkflow({
				store,
				projectId: '',
				taskId: 'task-1'
			})
		).resolves.toBe('プロジェクトを選択してください。');

		await expect(
			runCommitTaskDateRangeWorkflow({
				store,
				projectId: '',
				taskId: 'task-1',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				sourceTask: taskFixture()
			})
		).resolves.toBe('プロジェクトを選択してください。');
	});

	it('runReorderTasksWorkflow should validate projectId and apply reorder result', async () => {
		const reorder = vi
			.fn()
			.mockResolvedValue([
				taskFixture({ id: 'task-2', sortOrder: 0 }),
				taskFixture({ id: 'task-1', sortOrder: 1 })
			]);

		await expect(
			runReorderTasksWorkflow({
				store: { reorder },
				projectId: '',
				orderedTasks: [
					taskFixture({ id: 'task-1', sortOrder: 0 }),
					taskFixture({ id: 'task-2', sortOrder: 1 })
				],
				sourceTaskId: 'task-1',
				targetTaskId: 'task-2'
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'プロジェクトを選択してください。',
			actionSuccess: ''
		});

		await expect(
			runReorderTasksWorkflow({
				store: { reorder },
				projectId: 'project-1',
				orderedTasks: [taskFixture({ id: 'task-1' })],
				sourceTaskId: 'task-1',
				targetTaskId: 'task-1'
			})
		).resolves.toEqual({
			kind: 'noop'
		});

		await expect(
			runReorderTasksWorkflow({
				store: { reorder },
				projectId: 'project-1',
				orderedTasks: [
					taskFixture({ id: 'task-1', sortOrder: 0 }),
					taskFixture({ id: 'task-2', sortOrder: 1 })
				],
				sourceTaskId: 'task-1',
				targetTaskId: 'task-2'
			})
		).resolves.toEqual({
			kind: 'ok',
			actionError: '',
			actionSuccess: '',
			selectedTaskId: 'task-1'
		});
		expect(reorder).toHaveBeenCalledTimes(1);
	});

	it('runDeleteSelectedTaskWorkflow should handle noop and execute confirmed deletion', async () => {
		const remove = vi.fn().mockResolvedValue(undefined);

		await expect(
			runDeleteSelectedTaskWorkflow({
				store: { remove },
				projectId: 'project-1',
				targetTask: null,
				isBrowser: true,
				confirmDelete: vi.fn()
			})
		).resolves.toEqual({
			kind: 'noop'
		});

		const confirmDelete = vi.fn().mockReturnValue(false);
		await expect(
			runDeleteSelectedTaskWorkflow({
				store: { remove },
				projectId: 'project-1',
				targetTask: taskFixture({ id: 'task-1', title: '要件確認' }),
				isBrowser: true,
				confirmDelete
			})
		).resolves.toEqual({
			kind: 'noop'
		});
		expect(confirmDelete).toHaveBeenCalledWith('要件確認');

		await expect(
			runDeleteSelectedTaskWorkflow({
				store: { remove },
				projectId: 'project-1',
				targetTask: taskFixture({ id: 'task-1', title: '要件確認' }),
				isBrowser: true,
				confirmDelete: () => true
			})
		).resolves.toEqual({
			kind: 'ok',
			actionError: '',
			actionSuccess: ''
		});
		expect(remove).toHaveBeenCalledWith('project-1', 'task-1');
	});

	it('runPrepareTaskImportWorkflow should return needs_users when assignees are missing', async () => {
		const file = csvFile(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,未登録ユーザー,,'
			].join('\n')
		);

		const result = await runPrepareTaskImportWorkflow({
			projectId: 'project-1',
			file,
			projectMembers: [userFixture()],
			existingTaskIds: new Set<string>()
		});

		expect(result).toEqual({
			kind: 'needs_users',
			pendingImportRows: [
				{
					rowNumber: 2,
					taskId: 'task-1',
					title: '要件確認',
					startDate: '2026-02-20',
					endDate: '2026-02-21',
					progress: '40',
					assignees: '未登録ユーザー',
					predecessorTaskId: '',
					note: ''
				}
			],
			pendingImportFileName: 'tasks.csv',
			pendingMissingAssigneeNames: ['未登録ユーザー'],
			actionSuccess: ''
		});
	});

	it('runPrepareTaskImportWorkflow should return ready when all assignees are resolvable', async () => {
		const file = csvFile(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,伊藤,,'
			].join('\n')
		);

		const result = await runPrepareTaskImportWorkflow({
			projectId: 'project-1',
			file,
			projectMembers: [userFixture()],
			existingTaskIds: new Set<string>()
		});

		expect(result.kind).toBe('ready');
		if (result.kind !== 'ready') {
			return;
		}
		expect(result.projectId).toBe('project-1');
		expect(result.drafts).toHaveLength(1);
		expect(result.drafts[0]?.createInput.assigneeIds).toEqual(['user-1']);
	});

	it('runPrepareTaskImportWorkflow should surface missing project and parse failures', async () => {
		const brokenFile = {
			name: 'broken.csv',
			text: vi.fn(async () => {
				throw new Error('boom');
			})
		} as unknown as File;

		await expect(
			runPrepareTaskImportWorkflow({
				projectId: '',
				file: csvFile(''),
				projectMembers: [userFixture()],
				existingTaskIds: new Set<string>()
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'プロジェクトを選択してください。',
			actionSuccess: ''
		});

		await expect(
			runPrepareTaskImportWorkflow({
				projectId: 'project-1',
				file: csvFile('bad'),
				projectMembers: [userFixture()],
				existingTaskIds: new Set<string>()
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: '必須列 "title" が見つかりません。',
			actionSuccess: ''
		});

		await expect(
			runPrepareTaskImportWorkflow({
				projectId: 'project-1',
				file: brokenFile,
				projectMembers: [userFixture()],
				existingTaskIds: new Set<string>()
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'boom',
			actionSuccess: ''
		});
	});

	it('runResolveMissingAssigneesWorkflow should return noop when there is nothing pending', async () => {
		const result = await runResolveMissingAssigneesWorkflow({
			projectId: 'project-1',
			rows: null,
			missingAssigneeNames: [],
			users: [userFixture()],
			projectMembers: [userFixture()],
			existingTaskIds: new Set<string>(),
			createUser: vi.fn(),
			setProjectMembers: vi.fn(),
			reloadProject: vi.fn()
		});

		expect(result).toEqual({ kind: 'noop' });
	});

	it('runResolveMissingAssigneesWorkflow should create users, update members, and return drafts', async () => {
		const rows = parseTaskImportCsv(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,伊藤,,',
				'task-2,実装,2026-02-22,2026-02-23,20,田中,,'
			].join('\n')
		);
		const createUser = vi.fn().mockResolvedValue(
			userFixture({
				id: 'user-2',
				name: '田中'
			})
		);
		const setProjectMembers = vi.fn().mockResolvedValue([]);
		const reloadProject = vi.fn().mockResolvedValue([]);

		const result = await runResolveMissingAssigneesWorkflow({
			projectId: 'project-1',
			rows,
			missingAssigneeNames: ['田中'],
			users: [userFixture()],
			projectMembers: [userFixture()],
			existingTaskIds: new Set<string>(),
			createUser,
			setProjectMembers,
			reloadProject
		});

		expect(result.kind).toBe('ready');
		if (result.kind !== 'ready') {
			return;
		}
		expect(result.createdUsersCount).toBe(1);
		expect(result.drafts).toHaveLength(2);
		expect(setProjectMembers).toHaveBeenCalledWith('project-1', ['user-1', 'user-2']);
		expect(reloadProject).toHaveBeenCalledWith('project-1');
	});

	it('runResolveMissingAssigneesWorkflow should reuse known users and surface downstream failures', async () => {
		const rows = parseTaskImportCsv(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,田中,,'
			].join('\n')
		);
		const knownUser = userFixture({ id: 'user-2', name: '田中' });

		await expect(
			runResolveMissingAssigneesWorkflow({
				projectId: '',
				rows,
				missingAssigneeNames: ['田中'],
				users: [knownUser],
				projectMembers: [],
				existingTaskIds: new Set<string>(),
				createUser: vi.fn(),
				setProjectMembers: vi.fn(),
				reloadProject: vi.fn()
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'プロジェクトを選択してください。',
			actionSuccess: ''
		});

		const setProjectMembers = vi.fn().mockResolvedValue([]);
		const reloadProject = vi.fn().mockResolvedValue([]);
		const ready = await runResolveMissingAssigneesWorkflow({
			projectId: 'project-1',
			rows,
			missingAssigneeNames: ['田中'],
			users: [knownUser],
			projectMembers: [],
			existingTaskIds: new Set<string>(),
			createUser: vi.fn(),
			setProjectMembers,
			reloadProject
		});
		expect(ready.kind).toBe('ready');
		expect(setProjectMembers).toHaveBeenCalledWith('project-1', ['user-2']);

		await expect(
			runResolveMissingAssigneesWorkflow({
				projectId: 'project-1',
				rows,
				missingAssigneeNames: ['山田'],
				users: [],
				projectMembers: [],
				existingTaskIds: new Set<string>(),
				createUser: vi.fn().mockRejectedValue(new Error('create fail')),
				setProjectMembers: vi.fn(),
				reloadProject: vi.fn()
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'create fail',
			actionSuccess: ''
		});

		await expect(
			runResolveMissingAssigneesWorkflow({
				projectId: 'project-1',
				rows,
				missingAssigneeNames: ['田中'],
				users: [knownUser],
				projectMembers: [],
				existingTaskIds: new Set<string>(),
				createUser: vi.fn(),
				setProjectMembers: vi.fn().mockRejectedValue(new Error('member fail')),
				reloadProject: vi.fn()
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'member fail',
			actionSuccess: ''
		});

		const unresolvedRows = parseTaskImportCsv(
			[
				'タスクID,タイトル,開始日,終了日,進捗(%),担当者,先行タスクID,メモ',
				'task-1,要件確認,2026-02-20,2026-02-21,40,田中,,',
				'task-2,実装,2026-02-22,2026-02-23,20,佐藤,,'
			].join('\n')
		);
		await expect(
			runResolveMissingAssigneesWorkflow({
				projectId: 'project-1',
				rows: unresolvedRows,
				missingAssigneeNames: ['田中'],
				users: [],
				projectMembers: [],
				existingTaskIds: new Set<string>(),
				createUser: vi.fn().mockResolvedValue(knownUser),
				setProjectMembers: vi.fn().mockResolvedValue([]),
				reloadProject: vi.fn().mockResolvedValue([])
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: '担当者が未登録です: 佐藤',
			actionSuccess: ''
		});
	});

	it('runTaskImportWorkflow should include created user count in success message', async () => {
		const store = {
			create: vi.fn().mockResolvedValueOnce(taskFixture({ id: 'task-10' })),
			update: vi.fn()
		};

		const result = await runTaskImportWorkflow({
			store,
			projectId: 'project-1',
			drafts: [
				{
					sourceTaskId: null,
					predecessorSourceTaskId: null,
					createInput: {
						title: '要件確認',
						note: '',
						startDate: '2026-02-20',
						endDate: '2026-02-21',
						progress: 40,
						assigneeIds: [],
						predecessorTaskId: null
					}
				}
			],
			createdUsersCount: 2
		});

		expect(result).toEqual({
			kind: 'ok',
			actionSuccess: '1 件のタスクを取り込みました。2 名のユーザーを作成しました。',
			selectedTaskId: null,
			clearPendingImport: true
		});
	});

	it('runTaskImportWorkflow should return plain success and error results', async () => {
		const successStore = {
			create: vi.fn().mockResolvedValue(taskFixture({ id: 'task-11' })),
			update: vi.fn()
		};
		await expect(
			runTaskImportWorkflow({
				store: successStore,
				projectId: 'project-1',
				drafts: [
					{
						sourceTaskId: null,
						predecessorSourceTaskId: null,
						createInput: {
							title: '要件確認',
							note: '',
							startDate: '2026-02-20',
							endDate: '2026-02-21',
							progress: 40,
							assigneeIds: [],
							predecessorTaskId: null
						}
					}
				]
			})
		).resolves.toEqual({
			kind: 'ok',
			actionSuccess: '1 件のタスクを取り込みました。',
			selectedTaskId: null,
			clearPendingImport: true
		});

		const errorStore = {
			create: vi.fn().mockRejectedValue(new Error('import fail')),
			update: vi.fn()
		};
		await expect(
			runTaskImportWorkflow({
				store: errorStore,
				projectId: 'project-1',
				drafts: [
					{
						sourceTaskId: null,
						predecessorSourceTaskId: null,
						createInput: {
							title: '要件確認',
							note: '',
							startDate: '2026-02-20',
							endDate: '2026-02-21',
							progress: 40,
							assigneeIds: [],
							predecessorTaskId: null
						}
					}
				]
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'import fail'
		});
	});

	it('runReorderTasksWorkflow, export, delete, and commit should cover failure branches', async () => {
		await expect(
			runReorderTasksWorkflow({
				store: {
					reorder: vi.fn().mockRejectedValue(new Error('reorder fail'))
				},
				projectId: 'project-1',
				orderedTasks: [
					taskFixture({ id: 'task-1', sortOrder: 0 }),
					taskFixture({ id: 'task-2', sortOrder: 1 })
				],
				sourceTaskId: 'task-1',
				targetTaskId: 'task-2'
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'reorder fail',
			actionSuccess: ''
		});

		exportMocks.exportTasksAsCsv.mockImplementationOnce(() => {
			throw new Error('export fail');
		});
		await expect(
			runTaskExportWorkflow({
				format: 'csv',
				projectId: 'project-1',
				projectName: 'P1',
				tasks: [taskFixture()],
				users: [userFixture()],
				isBrowser: true
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'export fail'
		});

		await expect(
			runDeleteSelectedTaskWorkflow({
				store: {
					remove: vi.fn().mockRejectedValue(new Error('delete fail'))
				},
				projectId: 'project-1',
				targetTask: taskFixture({ id: 'task-1', title: '要件確認' }),
				isBrowser: true,
				confirmDelete: () => true
			})
		).resolves.toEqual({
			kind: 'error',
			actionError: 'delete fail',
			actionSuccess: ''
		});

		await expect(
			runCommitTaskDateRangeWorkflow({
				store: { update: vi.fn() },
				projectId: 'project-1',
				taskId: 'task-1',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				sourceTask: null
			})
		).resolves.toBeNull();
	});

	it('mergeUsersById should deduplicate by user id using last entry', () => {
		const merged = mergeUsersById(
			[
				userFixture({
					id: 'user-1',
					name: '伊藤'
				})
			],
			[
				userFixture({
					id: 'user-1',
					name: '伊藤(更新)'
				}),
				userFixture({
					id: 'user-2',
					name: '田中'
				})
			]
		);

		expect(merged).toEqual([
			userFixture({
				id: 'user-1',
				name: '伊藤(更新)'
			}),
			userFixture({
				id: 'user-2',
				name: '田中'
			})
		]);
	});
});
