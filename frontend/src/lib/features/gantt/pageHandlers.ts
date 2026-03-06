/**
 * `+page.svelte` で扱うイベントハンドラ群を集約するモジュールです。
 *
 * ルートコンポーネントの責務を「状態宣言・UI 配線」に寄せるため、
 * 操作手順と結果適用の遷移をこのファクトリへ分離しています。
 */

import type { CreateUserInput, Task, User } from '$lib/data/tasks/repo';
import { resolve } from '$app/paths';
import type { GanttTasksStore, ModalMode, TaskImportDraft } from './actions';
import {
	runChangeProjectWorkflow,
	runCommitTaskDateRangeWorkflow,
	runDeleteSelectedTaskWorkflow,
	runPrepareTaskImportWorkflow,
	runReorderTasksWorkflow,
	runResolveMissingAssigneesWorkflow,
	runSubmitTaskWorkflow,
	runTaskActionWorkflow,
	runTaskExportWorkflow,
	runTaskImportWorkflow
} from './actionWorkflows';
import type { TaskImportRow } from './import';
import { handleResultByKind } from './resultHandlers';
import {
	createTaskFormForCreate,
	toggleAssignee,
	type TaskFormInput,
	withTaskDatePreview,
	withoutTaskDatePreview
} from './state';
import type { TaskDateRange } from './types';

type GanttPageStore = Pick<GanttTasksStore, 'create' | 'load' | 'remove' | 'reorder' | 'update'>;

/**
 * 取り込み保留状態です。
 */
export type PendingImportState = {
	rows: TaskImportRow[] | null;
	fileName: string;
	missingAssigneeNames: string[];
};

/**
 * 画面ハンドラが参照する状態スナップショットです。
 */
export type GanttPageHandlerSnapshot = {
	editingTaskId: string | null;
	modalMode: ModalMode;
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
};

/**
 * 画面状態の参照・更新インターフェースです。
 */
export type GanttPageHandlerState = {
	read: () => GanttPageHandlerSnapshot;
	clearPendingImport: () => void;
	closeModal: () => void;
	setActionError: (message: string) => void;
	setActionSuccess: (message: string) => void;
	setEditingTaskId: (taskId: string | null) => void;
	setFormError: (message: string) => void;
	setIsExporting: (isExporting: boolean) => void;
	setIsImporting: (isImporting: boolean) => void;
	setIsModalOpen: (isModalOpen: boolean) => void;
	setIsSubmitting: (isSubmitting: boolean) => void;
	setModalMode: (mode: ModalMode) => void;
	setPendingImportState: (state: PendingImportState) => void;
	setSelectedProjectId: (projectId: string) => void;
	setSelectedTaskId: (taskId: string | null) => void;
	setTaskDatePreviews: (previews: Record<string, TaskDateRange>) => void;
	setTaskForm: (form: TaskFormInput) => void;
};

/**
 * 外部依存（リポジトリ・ブラウザ判定）です。
 */
export type GanttPageHandlerDependencies = {
	store: GanttPageStore;
	createUser: (input: CreateUserInput) => Promise<User>;
	setProjectMembers: (projectId: string, userIds: string[]) => Promise<User[]>;
	isBrowser: () => boolean;
	confirmDelete: (taskTitle: string) => boolean;
	emptyTaskForm: Readonly<TaskFormInput>;
};

/**
 * ルートから利用するハンドラ群です。
 */
export type GanttPageHandlers = {
	changeProject: (projectId: string) => Promise<void>;
	exportTasks: (format: 'csv' | 'xlsx') => Promise<void>;
	importTasks: (file: File) => Promise<void>;
	cancelPendingImport: () => void;
	createMissingUsersAndContinue: () => Promise<void>;
	reorderTasks: (sourceTaskId: string, targetTaskId: string) => Promise<void>;
	openCreateModal: () => void;
	openTaskEditPage: (task?: Task) => void;
	submitTask: (event: SubmitEvent) => Promise<void>;
	deleteSelectedTask: () => Promise<void>;
	commitTaskDateRange: (taskId: string, startDate: string, endDate: string) => Promise<void>;
	toggleFormAssignee: (userId: string) => void;
	setTaskDatePreview: (taskId: string, startDate: string, endDate: string) => void;
	clearTaskDatePreview: (taskId: string) => void;
};

/**
 * ガント画面のイベントハンドラ群を生成します。
 *
 * @param params 状態アクセス・外部依存
 * @returns 画面でそのままバインド可能なハンドラ群
 */
export function createGanttPageHandlers(params: {
	state: GanttPageHandlerState;
	deps: GanttPageHandlerDependencies;
}): GanttPageHandlers {
	const { state, deps } = params;

	function toTaskEditHref(task: Task): string {
		const path = resolve(`/tasks/${encodeURIComponent(task.id)}`);
		return `${path}?projectId=${encodeURIComponent(task.projectId)}`;
	}

	async function runTaskAction(action: () => Promise<string | null>): Promise<boolean> {
		const result = await runTaskActionWorkflow(action);
		state.setActionError(result.actionError);
		state.setActionSuccess(result.actionSuccess);
		return handleResultByKind(result, {
			ok: () => true,
			error: () => false
		});
	}

	async function executeTaskImport(options: {
		projectId: string;
		drafts: readonly TaskImportDraft[];
		createdUsersCount?: number;
	}): Promise<void> {
		const result = await runTaskImportWorkflow({
			store: deps.store,
			projectId: options.projectId,
			drafts: options.drafts,
			createdUsersCount: options.createdUsersCount
		});
		handleResultByKind(result, {
			error: (next) => {
				state.setActionError(next.actionError);
			},
			ok: (next) => {
				state.setActionSuccess(next.actionSuccess);
				state.setSelectedTaskId(next.selectedTaskId);
				const pendingImportActionByMode: Record<'clear' | 'keep', () => void> = {
					clear: () => state.clearPendingImport(),
					keep: () => {}
				};
				const modeByClearPending: Record<'true' | 'false', 'clear' | 'keep'> = {
					true: 'clear',
					false: 'keep'
				};
				const mode = modeByClearPending[String(next.clearPendingImport) as 'true' | 'false'];
				pendingImportActionByMode[mode]();
			}
		});
	}

	return {
		async changeProject(projectId: string): Promise<void> {
			const { selectedProjectId: currentProjectId } = state.read();
			if (!projectId || projectId === currentProjectId) {
				return;
			}

			state.setActionError('');
			state.setActionSuccess('');
			const result = await runChangeProjectWorkflow({
				store: deps.store,
				currentProjectId,
				nextProjectId: projectId
			});
			handleResultByKind(result, {
				error: (next) => {
					state.setActionError(next.message);
					state.setSelectedProjectId(next.projectId);
				},
				noop: () => {},
				ok: (next) => {
					state.clearPendingImport();
					state.setSelectedProjectId(next.projectId);
					state.setSelectedTaskId(null);
					state.setTaskDatePreviews({});
				}
			});
		},

		async exportTasks(format: 'csv' | 'xlsx'): Promise<void> {
			state.setActionError('');
			state.setActionSuccess('');
			state.setIsExporting(true);
			try {
				const snapshot = state.read();
				const result = await runTaskExportWorkflow({
					format,
					projectId: snapshot.selectedProjectId,
					projectName: snapshot.selectedProjectName,
					tasks: snapshot.orderedTasks,
					users: snapshot.users,
					isBrowser: deps.isBrowser()
				});
				handleResultByKind(result, {
					error: (next) => {
						state.setActionError(next.actionError);
					},
					noop: () => {},
					ok: () => {}
				});
			} finally {
				state.setIsExporting(false);
			}
		},

		async importTasks(file: File): Promise<void> {
			state.setActionError('');
			state.setActionSuccess('');
			state.setIsImporting(true);
			try {
				const snapshot = state.read();
				const result = await runPrepareTaskImportWorkflow({
					projectId: snapshot.selectedProjectId,
					file,
					projectMembers: snapshot.projectMembers,
					existingTaskIds: new Set(snapshot.orderedTasks.map((task) => task.id))
				});
				await handleResultByKind(result, {
					error: (next) => {
						state.setActionError(next.actionError);
						state.setActionSuccess(next.actionSuccess);
					},
					needs_users: (next) => {
						state.setPendingImportState({
							rows: next.pendingImportRows,
							fileName: next.pendingImportFileName,
							missingAssigneeNames: next.pendingMissingAssigneeNames
						});
						state.setActionSuccess(next.actionSuccess);
					},
					ready: async (next) => {
						await executeTaskImport({
							projectId: next.projectId,
							drafts: next.drafts
						});
					}
				});
			} finally {
				state.setIsImporting(false);
			}
		},

		cancelPendingImport(): void {
			state.clearPendingImport();
			state.setActionError('');
			state.setActionSuccess('取り込みをキャンセルしました。');
		},

		async createMissingUsersAndContinue(): Promise<void> {
			state.setActionError('');
			state.setActionSuccess('');
			state.setIsImporting(true);
			try {
				const snapshot = state.read();
				const result = await runResolveMissingAssigneesWorkflow({
					projectId: snapshot.selectedProjectId,
					rows: snapshot.pendingImportRows,
					missingAssigneeNames: snapshot.pendingMissingAssigneeNames,
					users: snapshot.users,
					projectMembers: snapshot.projectMembers,
					existingTaskIds: new Set(snapshot.orderedTasks.map((task) => task.id)),
					createUser: deps.createUser,
					setProjectMembers: deps.setProjectMembers,
					reloadProject: (projectId) => deps.store.load(projectId)
				});
				await handleResultByKind(result, {
					noop: () => {},
					error: (next) => {
						state.setActionError(next.actionError);
						state.setActionSuccess(next.actionSuccess);
					},
					ready: async (next) => {
						await executeTaskImport({
							projectId: next.projectId,
							drafts: next.drafts,
							createdUsersCount: next.createdUsersCount
						});
					}
				});
			} finally {
				state.setIsImporting(false);
			}
		},

		async reorderTasks(sourceTaskId: string, targetTaskId: string): Promise<void> {
			const snapshot = state.read();
			const result = await runReorderTasksWorkflow({
				store: deps.store,
				projectId: snapshot.selectedProjectId,
				orderedTasks: snapshot.orderedTasks,
				sourceTaskId,
				targetTaskId
			});
			handleResultByKind(result, {
				noop: () => {},
				error: (next) => {
					state.setActionError(next.actionError);
					state.setActionSuccess(next.actionSuccess);
				},
				ok: (next) => {
					state.setActionError(next.actionError);
					state.setActionSuccess(next.actionSuccess);
					state.setSelectedTaskId(next.selectedTaskId);
				}
			});
		},

		openCreateModal(): void {
			if (!state.read().selectedProjectId) {
				state.setActionError('プロジェクトを選択してください。');
				return;
			}
			state.setModalMode('create');
			state.setTaskForm(createTaskFormForCreate(deps.emptyTaskForm));
			state.setEditingTaskId(null);
			state.setFormError('');
			state.setIsModalOpen(true);
		},

		openTaskEditPage(task?: Task): void {
			const target = task ?? state.read().selectedTask;
			if (!target || !deps.isBrowser()) {
				return;
			}
			window.location.href = toTaskEditHref(target);
		},

		async submitTask(event: SubmitEvent): Promise<void> {
			event.preventDefault();
			state.setIsSubmitting(true);
			state.setFormError('');
			state.setActionError('');
			state.setActionSuccess('');
			try {
				const snapshot = state.read();
				const editingTaskId = snapshot.editingTaskId;
				const sourceTask = editingTaskId ? (snapshot.taskById.get(editingTaskId) ?? null) : null;
				const result = await runSubmitTaskWorkflow({
					store: deps.store,
					mode: snapshot.modalMode,
					projectId: snapshot.selectedProjectId,
					taskForm: snapshot.taskForm,
					editingTaskId,
					sourceTask
				});
				handleResultByKind(result, {
					error: (next) => {
						state.setFormError(next.formError);
					},
					ok: (next) => {
						state.setSelectedTaskId(next.selectedTaskId);
						state.closeModal();
					}
				});
			} finally {
				state.setIsSubmitting(false);
			}
		},

		async deleteSelectedTask(): Promise<void> {
			const snapshot = state.read();
			const result = await runDeleteSelectedTaskWorkflow({
				store: deps.store,
				projectId: snapshot.selectedProjectId,
				targetTask: snapshot.selectedTask,
				isBrowser: deps.isBrowser(),
				confirmDelete: deps.confirmDelete
			});
			handleResultByKind(result, {
				noop: () => {},
				error: (next) => {
					state.setActionError(next.actionError);
					state.setActionSuccess(next.actionSuccess);
				},
				ok: (next) => {
					state.setActionError(next.actionError);
					state.setActionSuccess(next.actionSuccess);
				}
			});
		},

		async commitTaskDateRange(taskId: string, startDate: string, endDate: string): Promise<void> {
			const snapshot = state.read();
			await runTaskAction(() =>
				runCommitTaskDateRangeWorkflow({
					store: deps.store,
					projectId: snapshot.selectedProjectId,
					taskId,
					startDate,
					endDate,
					sourceTask: snapshot.taskById.get(taskId) ?? null
				})
			);
		},

		toggleFormAssignee(userId: string): void {
			const currentTaskForm = state.read().taskForm;
			state.setTaskForm({
				...currentTaskForm,
				assigneeIds: toggleAssignee(currentTaskForm.assigneeIds, userId)
			});
		},

		setTaskDatePreview(taskId: string, startDate: string, endDate: string): void {
			const previews = state.read().taskDatePreviews;
			state.setTaskDatePreviews(withTaskDatePreview(previews, taskId, startDate, endDate));
		},

		clearTaskDatePreview(taskId: string): void {
			const previews = state.read().taskDatePreviews;
			state.setTaskDatePreviews(withoutTaskDatePreview(previews, taskId));
		}
	};
}
