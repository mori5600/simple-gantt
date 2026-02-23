import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Task } from '$lib/tasksRepo';
import {
	changeProjectSelectionAction,
	createMissingUsersAction,
	commitTaskDateRangeAction,
	deleteTaskAction,
	importTasksAction,
	loadInitialProjectAction,
	reorderTasksAction,
	shouldEnableGanttSync,
	submitTaskAction,
	type GanttTasksStore,
	type TaskImportDraft
} from './actions';

function projectFixture(partial: Partial<Project> = {}): Project {
	return {
		id: 'project-1',
		name: 'Project',
		sortOrder: 0,
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
		progress: 0,
		sortOrder: 0,
		updatedAt: '2026-02-20T00:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: null,
		...partial
	};
}

describe('gantt actions', () => {
	const store = {
		loadProjects: vi.fn(),
		load: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
		reorder: vi.fn()
	} satisfies GanttTasksStore;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loadInitialProjectAction should load stored project when present', async () => {
		store.loadProjects.mockResolvedValueOnce([
			projectFixture({ id: 'project-a' }),
			projectFixture({ id: 'project-b' })
		]);
		store.load.mockResolvedValueOnce([]);

		const actual = await loadInitialProjectAction({
			store,
			storedProjectId: 'project-b'
		});

		expect(actual).toEqual({
			kind: 'ok',
			projectId: 'project-b'
		});
		expect(store.load).toHaveBeenCalledWith('project-b');
	});

	it('loadInitialProjectAction should return empty when no project exists', async () => {
		store.loadProjects.mockResolvedValueOnce([]);

		const actual = await loadInitialProjectAction({
			store,
			storedProjectId: ''
		});

		expect(actual).toEqual({
			kind: 'empty',
			message: '利用可能なプロジェクトがありません。'
		});
	});

	it('submitTaskAction should update by reusing updatedAt from source task', async () => {
		store.update.mockResolvedValueOnce(taskFixture({ id: 'task-updated' }));

		const result = await submitTaskAction({
			store,
			mode: 'edit',
			projectId: 'project-1',
			createInput: {
				title: '更新後',
				note: '',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				progress: 10,
				assigneeIds: [],
				predecessorTaskId: null
			},
			editingTaskId: 'task-1',
			sourceTask: taskFixture()
		});

		expect(result).toEqual({
			kind: 'ok',
			selectedTaskId: 'task-updated'
		});
		expect(store.update).toHaveBeenCalledWith('project-1', 'task-1', {
			title: '更新後',
			note: '',
			startDate: '2026-02-20',
			endDate: '2026-02-21',
			progress: 10,
			assigneeIds: [],
			predecessorTaskId: null,
			updatedAt: '2026-02-20T00:00:00.000Z'
		});
	});

	it('importTasksAction should create tasks first and then resolve predecessor ids', async () => {
		const drafts: TaskImportDraft[] = [
			{
				sourceTaskId: 'source-task-1',
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
			},
			{
				sourceTaskId: 'source-task-2',
				predecessorSourceTaskId: 'source-task-1',
				createInput: {
					title: '実装',
					note: '',
					startDate: '2026-02-22',
					endDate: '2026-02-23',
					progress: 20,
					assigneeIds: [],
					predecessorTaskId: null
				}
			}
		];

		store.create
			.mockResolvedValueOnce(
				taskFixture({
					id: 'created-1',
					updatedAt: '2026-02-20T01:00:00.000Z'
				})
			)
			.mockResolvedValueOnce(
				taskFixture({
					id: 'created-2',
					updatedAt: '2026-02-20T02:00:00.000Z'
				})
			);
		store.update.mockResolvedValueOnce(
			taskFixture({
				id: 'created-2',
				updatedAt: '2026-02-20T03:00:00.000Z',
				predecessorTaskId: 'created-1'
			})
		);

		const result = await importTasksAction({
			store,
			projectId: 'project-1',
			drafts
		});

		expect(result).toEqual({
			kind: 'ok',
			importedCount: 2
		});
		expect(store.create).toHaveBeenNthCalledWith(1, 'project-1', drafts[0]?.createInput);
		expect(store.create).toHaveBeenNthCalledWith(2, 'project-1', drafts[1]?.createInput);
		expect(store.update).toHaveBeenCalledTimes(1);
		expect(store.update).toHaveBeenCalledWith('project-1', 'created-2', {
			updatedAt: '2026-02-20T02:00:00.000Z',
			predecessorTaskId: 'created-1'
		});
	});

	it('importTasksAction should return contract errors for empty input and missing project', async () => {
		await expect(
			importTasksAction({
				store,
				projectId: '',
				drafts: []
			})
		).resolves.toEqual({
			kind: 'error',
			message: 'プロジェクトを選択してください。'
		});

		await expect(
			importTasksAction({
				store,
				projectId: 'project-1',
				drafts: []
			})
		).resolves.toEqual({
			kind: 'error',
			message: '取込対象のタスクがありません。'
		});
	});

	it('createMissingUsersAction should create missing users in deterministic order', async () => {
		const createUser = vi
			.fn()
			.mockResolvedValueOnce({
				id: 'user-10',
				name: '新規A',
				updatedAt: '2026-02-23T00:00:00.000Z'
			})
			.mockResolvedValueOnce({
				id: 'user-11',
				name: '新規B',
				updatedAt: '2026-02-23T00:00:00.000Z'
			});

		const result = await createMissingUsersAction({
			missingNames: ['新規A', '新規B', '新規A'],
			createUser
		});

		expect(result).toEqual({
			kind: 'ok',
			createdUsers: [
				{
					id: 'user-10',
					name: '新規A',
					updatedAt: '2026-02-23T00:00:00.000Z'
				},
				{
					id: 'user-11',
					name: '新規B',
					updatedAt: '2026-02-23T00:00:00.000Z'
				}
			],
			createdCount: 2
		});
		expect(createUser).toHaveBeenCalledTimes(2);
		expect(createUser).toHaveBeenNthCalledWith(1, { name: '新規A' });
		expect(createUser).toHaveBeenNthCalledWith(2, { name: '新規B' });
	});

	it('createMissingUsersAction should map errors into user-facing message', async () => {
		const createUser = vi.fn().mockRejectedValueOnce(new Error('user create failed'));

		const result = await createMissingUsersAction({
			missingNames: ['新規A'],
			createUser
		});

		expect(result).toEqual({
			kind: 'error',
			message: 'user create failed'
		});
	});

	it('simple actions should map errors to user-facing messages', async () => {
		store.reorder.mockRejectedValueOnce(new Error('reorder failed'));
		store.remove.mockRejectedValueOnce(new Error('remove failed'));
		store.update.mockRejectedValueOnce(new Error('date update failed'));

		await expect(
			reorderTasksAction({
				store,
				projectId: 'project-1',
				ids: ['task-1']
			})
		).resolves.toBe('reorder failed');
		await expect(
			deleteTaskAction({
				store,
				projectId: 'project-1',
				taskId: 'task-1'
			})
		).resolves.toBe('remove failed');
		await expect(
			commitTaskDateRangeAction({
				store,
				projectId: 'project-1',
				taskId: 'task-1',
				startDate: '2026-02-20',
				endDate: '2026-02-21',
				updatedAt: '2026-02-20T00:00:00.000Z'
			})
		).resolves.toBe('date update failed');
	});

	it('changeProjectSelectionAction should keep previous project when loading next project fails', async () => {
		store.load.mockRejectedValueOnce(new Error('cannot switch project'));

		const result = await changeProjectSelectionAction({
			store,
			currentProjectId: 'project-a',
			nextProjectId: 'project-b'
		});

		expect(result).toEqual({
			kind: 'error',
			projectId: 'project-a',
			message: 'cannot switch project'
		});
	});

	it('changeProjectSelectionAction should return ok with next project id on success', async () => {
		store.load.mockResolvedValueOnce([]);

		const result = await changeProjectSelectionAction({
			store,
			currentProjectId: 'project-a',
			nextProjectId: 'project-b'
		});

		expect(result).toEqual({
			kind: 'ok',
			projectId: 'project-b'
		});
	});

	it('shouldEnableGanttSync should require initialization, selected project, and idle submission state', () => {
		expect(
			shouldEnableGanttSync({
				selectedProjectId: 'project-a',
				isSubmitting: false,
				isInitialized: false
			})
		).toBe(false);

		expect(
			shouldEnableGanttSync({
				selectedProjectId: '',
				isSubmitting: false,
				isInitialized: true
			})
		).toBe(false);

		expect(
			shouldEnableGanttSync({
				selectedProjectId: 'project-a',
				isSubmitting: true,
				isInitialized: true
			})
		).toBe(false);

		expect(
			shouldEnableGanttSync({
				selectedProjectId: 'project-a',
				isSubmitting: false,
				isInitialized: true
			})
		).toBe(true);
	});
});
