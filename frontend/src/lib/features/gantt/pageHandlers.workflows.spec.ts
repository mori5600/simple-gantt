import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task, User } from '$lib/data/tasks/repo';
import type { TaskDateRange } from './types';
import type { TaskFormInput } from './state';
import type { TaskImportRow } from './import';

const workflowMocks = vi.hoisted(() => ({
	runChangeProjectWorkflow: vi.fn(),
	runCommitTaskDateRangeWorkflow: vi.fn(),
	runDeleteSelectedTaskWorkflow: vi.fn(),
	runPrepareTaskImportWorkflow: vi.fn(),
	runReorderTasksWorkflow: vi.fn(),
	runResolveMissingAssigneesWorkflow: vi.fn(),
	runSubmitTaskWorkflow: vi.fn(),
	runTaskActionWorkflow: vi.fn(),
	runTaskExportWorkflow: vi.fn(),
	runTaskImportWorkflow: vi.fn()
}));

vi.mock('./actionWorkflows', () => workflowMocks);

import { createGanttPageHandlers } from './pageHandlers';

function taskFixture(partial: Partial<Task> = {}): Task {
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
		assigneeIds: [],
		predecessorTaskId: null,
		...partial
	};
}

function pendingImportRowFixture(partial: Partial<TaskImportRow> = {}): TaskImportRow {
	return {
		rowNumber: 2,
		taskId: 'task-9',
		title: '新規タスク',
		startDate: '2026-03-10',
		endDate: '2026-03-12',
		progress: '30',
		assignees: '',
		predecessorTaskId: '',
		note: '',
		...partial
	};
}

function createHandlerHarness(
	overrides: Partial<{
		editingTaskId: string | null;
		modalMode: 'create' | 'edit';
		orderedTasks: Task[];
		pendingImportRows: TaskImportRow[] | null;
		pendingMissingAssigneeNames: string[];
		projectMembers: User[];
		selectedProjectId: string;
		selectedProjectName: string;
		selectedTask: Task | null;
		taskById: ReadonlyMap<string, Task>;
		taskDatePreviews: Record<string, TaskDateRange>;
		taskForm: TaskFormInput;
		users: User[];
	}> = {}
) {
	const emptyTaskForm = {
		title: '',
		note: '',
		startDate: '',
		endDate: '',
		progress: 0,
		assigneeIds: [],
		predecessorTaskId: ''
	} satisfies TaskFormInput;
	const snapshot = {
		editingTaskId: null,
		modalMode: 'create' as const,
		orderedTasks: [taskFixture()],
		pendingImportRows: null as TaskImportRow[] | null,
		pendingMissingAssigneeNames: [] as string[],
		projectMembers: [] as User[],
		selectedProjectId: 'project-1',
		selectedProjectName: 'Project 1',
		selectedTask: taskFixture(),
		taskById: new Map<string, Task>([['task-1', taskFixture()]]),
		taskDatePreviews: {} as Record<string, TaskDateRange>,
		taskForm: emptyTaskForm,
		users: [] as User[],
		...overrides
	};
	const store = {
		create: vi.fn(),
		load: vi.fn(),
		remove: vi.fn(),
		reorder: vi.fn(),
		update: vi.fn()
	};
	const state = {
		read: vi.fn(() => snapshot),
		clearPendingImport: vi.fn(() => {
			snapshot.pendingImportRows = null;
			snapshot.pendingMissingAssigneeNames = [];
		}),
		closeModal: vi.fn(),
		setActionError: vi.fn(),
		setActionSuccess: vi.fn(),
		setEditingTaskId: vi.fn((taskId: string | null) => {
			snapshot.editingTaskId = taskId;
		}),
		setFormError: vi.fn(),
		setIsExporting: vi.fn(),
		setIsImporting: vi.fn(),
		setIsModalOpen: vi.fn(),
		setIsSubmitting: vi.fn(),
		setModalMode: vi.fn((mode: 'create' | 'edit') => {
			snapshot.modalMode = mode;
		}),
		setPendingImportState: vi.fn(
			(next: { rows: TaskImportRow[] | null; missingAssigneeNames: string[] }) => {
				snapshot.pendingImportRows = next.rows;
				snapshot.pendingMissingAssigneeNames = next.missingAssigneeNames;
			}
		),
		setSelectedProjectId: vi.fn((projectId: string) => {
			snapshot.selectedProjectId = projectId;
		}),
		setSelectedTaskId: vi.fn(),
		setTaskDatePreviews: vi.fn((previews: Record<string, TaskDateRange>) => {
			snapshot.taskDatePreviews = previews;
		}),
		setTaskForm: vi.fn((form: TaskFormInput) => {
			snapshot.taskForm = form;
		})
	};
	const deps = {
		store,
		createUser: vi.fn(),
		setProjectMembers: vi.fn(),
		isBrowser: vi.fn(() => true),
		confirmDelete: vi.fn(() => true),
		emptyTaskForm
	};

	return {
		handlers: createGanttPageHandlers({ state, deps }),
		snapshot,
		state,
		deps
	};
}

describe('pageHandlers workflow integration', () => {
	beforeEach(() => {
		workflowMocks.runTaskActionWorkflow.mockImplementation(async (action) => {
			const error = await action();
			if (error) {
				return {
					kind: 'error',
					actionError: error,
					actionSuccess: ''
				};
			}
			return {
				kind: 'ok',
				actionError: '',
				actionSuccess: ''
			};
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('changeProject should ignore empty or unchanged project ids', async () => {
		const harness = createHandlerHarness();

		await harness.handlers.changeProject('');
		await harness.handlers.changeProject('project-1');

		expect(workflowMocks.runChangeProjectWorkflow).not.toHaveBeenCalled();
	});

	it('changeProject should reset selection state after a successful project switch', async () => {
		const harness = createHandlerHarness({
			taskDatePreviews: {
				'task-1': {
					startDate: '2026-03-10',
					endDate: '2026-03-12'
				}
			}
		});
		workflowMocks.runChangeProjectWorkflow.mockResolvedValue({
			kind: 'ok',
			projectId: 'project-2'
		});

		await harness.handlers.changeProject('project-2');

		expect(workflowMocks.runChangeProjectWorkflow).toHaveBeenCalledWith({
			store: harness.deps.store,
			currentProjectId: 'project-1',
			nextProjectId: 'project-2'
		});
		expect(harness.state.clearPendingImport).toHaveBeenCalledOnce();
		expect(harness.state.setSelectedProjectId).toHaveBeenCalledWith('project-2');
		expect(harness.state.setSelectedTaskId).toHaveBeenCalledWith(null);
		expect(harness.state.setTaskDatePreviews).toHaveBeenCalledWith({});
	});

	it('exportTasks should reflect workflow errors and always finish exporting state', async () => {
		const harness = createHandlerHarness();
		workflowMocks.runTaskExportWorkflow.mockResolvedValue({
			kind: 'error',
			actionError: '出力に失敗しました。'
		});

		await harness.handlers.exportTasks('csv');

		expect(workflowMocks.runTaskExportWorkflow).toHaveBeenCalledWith({
			format: 'csv',
			projectId: 'project-1',
			projectName: 'Project 1',
			tasks: harness.snapshot.orderedTasks,
			users: harness.snapshot.users,
			isBrowser: true
		});
		expect(harness.state.setIsExporting).toHaveBeenNthCalledWith(1, true);
		expect(harness.state.setActionError).toHaveBeenLastCalledWith('出力に失敗しました。');
		expect(harness.state.setIsExporting).toHaveBeenLastCalledWith(false);
	});

	it('importTasks should keep pending rows when assignees are missing', async () => {
		const harness = createHandlerHarness();
		const pendingRows = [pendingImportRowFixture()];
		workflowMocks.runPrepareTaskImportWorkflow.mockResolvedValue({
			kind: 'needs_users',
			pendingImportRows: pendingRows,
			pendingImportFileName: 'tasks.csv',
			pendingMissingAssigneeNames: ['山田'],
			actionSuccess: ''
		});

		await harness.handlers.importTasks(new File(['id,title'], 'tasks.csv', { type: 'text/csv' }));

		expect(harness.state.setPendingImportState).toHaveBeenCalledWith({
			rows: pendingRows,
			fileName: 'tasks.csv',
			missingAssigneeNames: ['山田']
		});
		expect(workflowMocks.runTaskImportWorkflow).not.toHaveBeenCalled();
		expect(harness.state.setIsImporting).toHaveBeenNthCalledWith(1, true);
		expect(harness.state.setIsImporting).toHaveBeenLastCalledWith(false);
	});

	it('importTasks should execute imports immediately when drafts are ready', async () => {
		const harness = createHandlerHarness();
		const drafts = [{ title: '新規タスク' }];
		workflowMocks.runPrepareTaskImportWorkflow.mockResolvedValue({
			kind: 'ready',
			projectId: 'project-1',
			drafts
		});
		workflowMocks.runTaskImportWorkflow.mockResolvedValue({
			kind: 'ok',
			actionSuccess: '1 件のタスクを取り込みました。',
			selectedTaskId: 'task-9',
			clearPendingImport: true
		});

		await harness.handlers.importTasks(new File(['id,title'], 'tasks.csv', { type: 'text/csv' }));

		expect(workflowMocks.runTaskImportWorkflow).toHaveBeenCalledWith({
			store: harness.deps.store,
			projectId: 'project-1',
			drafts,
			createdUsersCount: undefined
		});
		expect(harness.state.setActionSuccess).toHaveBeenLastCalledWith(
			'1 件のタスクを取り込みました。'
		);
		expect(harness.state.setSelectedTaskId).toHaveBeenCalledWith('task-9');
		expect(harness.state.clearPendingImport).toHaveBeenCalledOnce();
	});

	it('importTasks should surface prepare errors without starting an import', async () => {
		const harness = createHandlerHarness();
		workflowMocks.runPrepareTaskImportWorkflow.mockResolvedValue({
			kind: 'error',
			actionError: '取込に失敗しました。',
			actionSuccess: ''
		});

		await harness.handlers.importTasks(new File(['id,title'], 'tasks.csv', { type: 'text/csv' }));

		expect(harness.state.setActionError).toHaveBeenLastCalledWith('取込に失敗しました。');
		expect(harness.state.setActionSuccess).toHaveBeenLastCalledWith('');
		expect(workflowMocks.runTaskImportWorkflow).not.toHaveBeenCalled();
	});

	it('createMissingUsersAndContinue should continue import when missing assignees are resolved', async () => {
		const harness = createHandlerHarness({
			pendingImportRows: [pendingImportRowFixture()],
			pendingMissingAssigneeNames: ['山田']
		});
		const drafts = [{ title: '新規タスク' }];
		workflowMocks.runResolveMissingAssigneesWorkflow.mockResolvedValue({
			kind: 'ready',
			projectId: 'project-1',
			drafts,
			createdUsersCount: 2
		});
		workflowMocks.runTaskImportWorkflow.mockResolvedValue({
			kind: 'ok',
			actionSuccess: '1 件のタスクを取り込みました。2 名のユーザーを作成しました。',
			selectedTaskId: 'task-9',
			clearPendingImport: false
		});

		await harness.handlers.createMissingUsersAndContinue();

		expect(workflowMocks.runResolveMissingAssigneesWorkflow).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: 'project-1',
				rows: harness.snapshot.pendingImportRows,
				missingAssigneeNames: ['山田'],
				reloadProject: expect.any(Function)
			})
		);
		expect(workflowMocks.runTaskImportWorkflow).toHaveBeenCalledWith({
			store: harness.deps.store,
			projectId: 'project-1',
			drafts,
			createdUsersCount: 2
		});
		expect(harness.state.clearPendingImport).not.toHaveBeenCalled();
		expect(harness.state.setSelectedTaskId).toHaveBeenCalledWith('task-9');
	});

	it('createMissingUsersAndContinue should no-op when nothing is pending', async () => {
		const harness = createHandlerHarness();
		workflowMocks.runResolveMissingAssigneesWorkflow.mockResolvedValue({
			kind: 'noop'
		});

		await harness.handlers.createMissingUsersAndContinue();

		expect(harness.state.setActionError).toHaveBeenCalledWith('');
		expect(harness.state.setActionSuccess).toHaveBeenCalledWith('');
		expect(workflowMocks.runTaskImportWorkflow).not.toHaveBeenCalled();
	});

	it('createMissingUsersAndContinue should surface workflow errors and use the reload helper', async () => {
		const harness = createHandlerHarness({
			pendingImportRows: [pendingImportRowFixture()],
			pendingMissingAssigneeNames: ['山田']
		});
		workflowMocks.runResolveMissingAssigneesWorkflow.mockImplementation(async (params) => {
			await params.reloadProject('project-1');
			return {
				kind: 'error',
				actionError: 'ユーザー作成に失敗しました。',
				actionSuccess: ''
			};
		});

		await harness.handlers.createMissingUsersAndContinue();

		expect(harness.deps.store.load).toHaveBeenCalledWith('project-1');
		expect(harness.state.setActionError).toHaveBeenLastCalledWith('ユーザー作成に失敗しました。');
		expect(harness.state.setActionSuccess).toHaveBeenLastCalledWith('');
	});

	it('cancelPendingImport should clear pending state and show a cancellation message', () => {
		const harness = createHandlerHarness({
			pendingImportRows: [pendingImportRowFixture()],
			pendingMissingAssigneeNames: ['山田']
		});

		harness.handlers.cancelPendingImport();

		expect(harness.state.clearPendingImport).toHaveBeenCalledOnce();
		expect(harness.state.setActionError).toHaveBeenLastCalledWith('');
		expect(harness.state.setActionSuccess).toHaveBeenLastCalledWith(
			'取り込みをキャンセルしました。'
		);
	});

	it('reorderTasks should apply success and error feedback from the workflow', async () => {
		const successHarness = createHandlerHarness();
		workflowMocks.runReorderTasksWorkflow.mockResolvedValueOnce({
			kind: 'ok',
			actionError: '',
			actionSuccess: '',
			selectedTaskId: 'task-2'
		});

		await successHarness.handlers.reorderTasks('task-2', 'task-1');

		expect(workflowMocks.runReorderTasksWorkflow).toHaveBeenCalledWith({
			store: successHarness.deps.store,
			projectId: 'project-1',
			orderedTasks: successHarness.snapshot.orderedTasks,
			sourceTaskId: 'task-2',
			targetTaskId: 'task-1'
		});
		expect(successHarness.state.setSelectedTaskId).toHaveBeenLastCalledWith('task-2');

		const errorHarness = createHandlerHarness();
		workflowMocks.runReorderTasksWorkflow.mockResolvedValueOnce({
			kind: 'error',
			actionError: '並び替えに失敗しました。',
			actionSuccess: ''
		});

		await errorHarness.handlers.reorderTasks('task-2', 'task-1');

		expect(errorHarness.state.setActionError).toHaveBeenLastCalledWith('並び替えに失敗しました。');
		expect(errorHarness.state.setActionSuccess).toHaveBeenLastCalledWith('');
	});

	it('openCreateModal should guard missing projects and initialize the modal state otherwise', () => {
		const missingProjectHarness = createHandlerHarness({
			selectedProjectId: ''
		});

		missingProjectHarness.handlers.openCreateModal();

		expect(missingProjectHarness.state.setActionError).toHaveBeenCalledWith(
			'プロジェクトを選択してください。'
		);

		const readyHarness = createHandlerHarness({
			taskForm: {
				title: '既存値',
				note: 'note',
				startDate: '2026-03-01',
				endDate: '2026-03-02',
				progress: 50,
				assigneeIds: ['user-1'],
				predecessorTaskId: 'task-9'
			}
		});

		readyHarness.handlers.openCreateModal();

		expect(readyHarness.state.setModalMode).toHaveBeenCalledWith('create');
		expect(readyHarness.state.setTaskForm).toHaveBeenCalledWith(
			expect.objectContaining({
				title: '',
				note: '',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: ''
			})
		);
		expect(readyHarness.state.setEditingTaskId).toHaveBeenCalledWith(null);
		expect(readyHarness.state.setFormError).toHaveBeenCalledWith('');
		expect(readyHarness.state.setIsModalOpen).toHaveBeenCalledWith(true);
	});

	it('submitTask should close the modal on success and show form errors on failure', async () => {
		const successHarness = createHandlerHarness();
		const submitEvent = {
			preventDefault: vi.fn()
		} as unknown as SubmitEvent;
		workflowMocks.runSubmitTaskWorkflow.mockResolvedValueOnce({
			kind: 'ok',
			selectedTaskId: 'task-1'
		});

		await successHarness.handlers.submitTask(submitEvent);

		expect(submitEvent.preventDefault).toHaveBeenCalledOnce();
		expect(successHarness.state.setSelectedTaskId).toHaveBeenCalledWith('task-1');
		expect(successHarness.state.closeModal).toHaveBeenCalledOnce();
		expect(successHarness.state.setIsSubmitting).toHaveBeenLastCalledWith(false);

		const errorHarness = createHandlerHarness();
		workflowMocks.runSubmitTaskWorkflow.mockResolvedValueOnce({
			kind: 'error',
			formError: 'タイトルを入力してください。'
		});

		await errorHarness.handlers.submitTask({
			preventDefault: vi.fn()
		} as unknown as SubmitEvent);

		expect(errorHarness.state.setFormError).toHaveBeenLastCalledWith(
			'タイトルを入力してください。'
		);
	});

	it('deleteSelectedTask and commitTaskDateRange should surface workflow feedback', async () => {
		const deleteHarness = createHandlerHarness();
		workflowMocks.runDeleteSelectedTaskWorkflow.mockResolvedValue({
			kind: 'error',
			actionError: '削除に失敗しました。',
			actionSuccess: ''
		});

		await deleteHarness.handlers.deleteSelectedTask();

		expect(deleteHarness.state.setActionError).toHaveBeenLastCalledWith('削除に失敗しました。');
		expect(deleteHarness.state.setActionSuccess).toHaveBeenLastCalledWith('');

		const dateHarness = createHandlerHarness({
			taskById: new Map<string, Task>([['task-2', taskFixture({ id: 'task-2' })]])
		});
		workflowMocks.runCommitTaskDateRangeWorkflow.mockResolvedValue('更新に失敗しました。');

		await dateHarness.handlers.commitTaskDateRange('task-2', '2026-03-10', '2026-03-12');

		expect(workflowMocks.runCommitTaskDateRangeWorkflow).toHaveBeenCalledWith({
			store: dateHarness.deps.store,
			projectId: 'project-1',
			taskId: 'task-2',
			startDate: '2026-03-10',
			endDate: '2026-03-12',
			sourceTask: taskFixture({ id: 'task-2' })
		});
		expect(dateHarness.state.setActionError).toHaveBeenLastCalledWith('更新に失敗しました。');
		expect(dateHarness.state.setActionSuccess).toHaveBeenLastCalledWith('');
	});

	it('deleteSelectedTask should preserve cleared feedback on successful deletion', async () => {
		const harness = createHandlerHarness();
		workflowMocks.runDeleteSelectedTaskWorkflow.mockResolvedValue({
			kind: 'ok',
			actionError: '',
			actionSuccess: ''
		});

		await harness.handlers.deleteSelectedTask();

		expect(harness.state.setActionError).toHaveBeenLastCalledWith('');
		expect(harness.state.setActionSuccess).toHaveBeenLastCalledWith('');
	});
});
