/**
 * ガント画面のアクション実行ワークフローを集約するモジュールです。
 *
 * `+page.svelte` から「アクション呼び出しの手順」と「結果の解釈ルール」を分離し、
 * ルート側を状態反映と UI 配線に集中させるために定義しています。
 */

import type { CreateUserInput, Task, User } from '$lib/data/tasks/repo';
import { exportTasksAsCsv, exportTasksAsXlsx } from './export';
import {
	changeProjectSelectionAction,
	commitTaskDateRangeAction,
	createMissingUsersAction,
	deleteTaskAction,
	importTasksAction,
	reorderTasksAction,
	submitTaskAction,
	type CommitTaskDateRangeResult,
	type ChangeProjectSelectionResult,
	type GanttTasksStore,
	type ModalMode,
	type SubmitTaskResult,
	type TaskImportDraft
} from './actions';
import { reorderTaskIds, toCreateTaskInput, validateTaskForm, type TaskFormInput } from './state';
import {
	planTaskImportDrafts,
	parseTaskImportFile,
	TaskImportContractError,
	type TaskImportRow
} from './import';
import { handleResultByKind } from './resultHandlers';

/**
 * タスク送信ワークフローの結果です。
 */
export type SubmitTaskWorkflowResult =
	| { kind: 'error'; formError: string }
	| { kind: 'ok'; selectedTaskId: string };

/**
 * 取込ファイル解析ワークフローの結果です。
 */
export type PrepareTaskImportWorkflowResult =
	| { kind: 'error'; actionError: string; actionSuccess: '' }
	| {
			kind: 'needs_users';
			pendingImportRows: TaskImportRow[];
			pendingImportFileName: string;
			pendingMissingAssigneeNames: string[];
			actionSuccess: '';
	  }
	| { kind: 'ready'; projectId: string; drafts: readonly TaskImportDraft[] };

/**
 * 不足担当者の解決ワークフローの結果です。
 */
export type ResolveMissingAssigneesWorkflowResult =
	| { kind: 'noop' }
	| { kind: 'error'; actionError: string; actionSuccess: '' }
	| {
			kind: 'ready';
			projectId: string;
			drafts: readonly TaskImportDraft[];
			createdUsersCount: number;
	  };

/**
 * タスク出力ワークフローの結果です。
 */
export type ExportTasksWorkflowResult =
	| { kind: 'ok' }
	| { kind: 'noop' }
	| { kind: 'error'; actionError: string };

/**
 * タスク並び替えワークフローの結果です。
 */
export type ReorderTasksWorkflowResult =
	| { kind: 'noop' }
	| { kind: 'error'; actionError: string; actionSuccess: '' }
	| { kind: 'ok'; actionError: ''; actionSuccess: ''; selectedTaskId: string };

/**
 * 選択タスク削除ワークフローの結果です。
 */
export type DeleteSelectedTaskWorkflowResult =
	| { kind: 'noop' }
	| { kind: 'error'; actionError: string; actionSuccess: '' }
	| { kind: 'ok'; actionError: ''; actionSuccess: '' };

/**
 * タスク期間更新ワークフローの結果です。
 */
export type CommitTaskDateRangeWorkflowResult =
	| { kind: 'error'; actionError: string; actionSuccess: '' }
	| { kind: 'ok'; actionError: ''; actionSuccess: ''; task: Task };

/**
 * 単一アクション実行ワークフローの結果です。
 */
export type TaskActionWorkflowResult =
	| { kind: 'ok'; actionError: ''; actionSuccess: '' }
	| { kind: 'error'; actionError: string; actionSuccess: '' };

type ExportFormat = 'csv' | 'xlsx';

type ExportTaskParams = {
	projectId: string;
	projectName: string;
	tasks: readonly Task[];
	users: readonly User[];
};

type ExportTaskStrategy = (params: ExportTaskParams) => Promise<void>;

const EXPORT_TASK_STRATEGIES: Record<ExportFormat, ExportTaskStrategy> = {
	csv: async (params) => {
		exportTasksAsCsv(params);
	},
	xlsx: async (params) => {
		await exportTasksAsXlsx(params);
	}
};

type ImportSuccessMessageMode = 'with_created_users' | 'without_created_users';

const IMPORT_SUCCESS_MESSAGE_BY_MODE: Record<
	ImportSuccessMessageMode,
	(importedCount: number, createdUsersCount: number) => string
> = {
	with_created_users: (importedCount, createdUsersCount) =>
		`${importedCount} 件のタスクを取り込みました。${createdUsersCount} 名のユーザーを作成しました。`,
	without_created_users: (importedCount) => `${importedCount} 件のタスクを取り込みました。`
};

type TaskActionKind = TaskActionWorkflowResult['kind'];

const TASK_ACTION_KIND_BY_HAS_ERROR: Record<'true' | 'false', TaskActionKind> = {
	true: 'error',
	false: 'ok'
};

const TASK_ACTION_RESULT_BY_KIND: Record<
	TaskActionKind,
	(error: string | null) => TaskActionWorkflowResult
> = {
	ok: () => {
		return {
			kind: 'ok',
			actionError: '',
			actionSuccess: ''
		};
	},
	error: (error) => {
		return {
			kind: 'error',
			actionError: error ?? '処理に失敗しました。',
			actionSuccess: ''
		};
	}
};

/**
 * プロジェクト切替アクションを実行します。
 *
 * ルート側の責務を「結果の適用」に限定するため、
 * 実処理の呼び出しはワークフロー関数に集約します。
 */
export function runChangeProjectWorkflow(params: {
	store: Pick<GanttTasksStore, 'load'>;
	currentProjectId: string;
	nextProjectId: string;
}): Promise<ChangeProjectSelectionResult> {
	return changeProjectSelectionAction(params);
}

/**
 * タスク作成・更新ワークフローを実行します。
 *
 * ルート側から入力値検証と `CreateTaskInput` 変換を分離し、
 * 送信処理の一貫性を保つために定義しています。
 */
export async function runSubmitTaskWorkflow(params: {
	store: Pick<GanttTasksStore, 'create' | 'update'>;
	mode: ModalMode;
	projectId: string;
	taskForm: TaskFormInput;
	editingTaskId: string | null;
	sourceTask: Task | null;
}): Promise<SubmitTaskWorkflowResult> {
	if (!params.projectId) {
		return {
			kind: 'error',
			formError: 'プロジェクトを選択してください。'
		};
	}

	const normalizedForm: TaskFormInput = {
		...params.taskForm,
		progress: Number(params.taskForm.progress)
	};
	const validationError = validateTaskForm(normalizedForm);
	if (validationError) {
		return {
			kind: 'error',
			formError: validationError
		};
	}

	const actionResult: SubmitTaskResult = await submitTaskAction({
		store: params.store,
		mode: params.mode,
		projectId: params.projectId,
		createInput: toCreateTaskInput(normalizedForm),
		editingTaskId: params.editingTaskId,
		sourceTask: params.sourceTask
	});
	if (actionResult.kind === 'error') {
		return {
			kind: 'error',
			formError: actionResult.message
		};
	}

	return {
		kind: 'ok',
		selectedTaskId: actionResult.selectedTaskId
	};
}

/**
 * 取込ファイルの解析と取込計画作成を実行します。
 *
 * `+page.svelte` からファイル解析・不足担当者判定・エラー整形を分離し、
 * 画面側が結果分岐のみを扱えるようにするために定義しています。
 */
export async function runPrepareTaskImportWorkflow(params: {
	projectId: string;
	file: File;
	projectMembers: readonly User[];
	existingTaskIds: ReadonlySet<string>;
}): Promise<PrepareTaskImportWorkflowResult> {
	if (!params.projectId) {
		return {
			kind: 'error',
			actionError: 'プロジェクトを選択してください。',
			actionSuccess: ''
		};
	}

	try {
		const rows = await parseTaskImportFile(params.file);
		const plan = planTaskImportDrafts({
			rows,
			users: params.projectMembers,
			existingTaskIds: params.existingTaskIds,
			allowMissingAssignees: true
		});
		if (plan.kind === 'missing_assignees') {
			return {
				kind: 'needs_users',
				pendingImportRows: rows,
				pendingImportFileName: params.file.name,
				pendingMissingAssigneeNames: plan.missingAssigneeNames,
				actionSuccess: ''
			};
		}
		return {
			kind: 'ready',
			projectId: params.projectId,
			drafts: plan.drafts
		};
	} catch (error) {
		if (error instanceof TaskImportContractError) {
			return {
				kind: 'error',
				actionError: error.message,
				actionSuccess: ''
			};
		}
		return {
			kind: 'error',
			actionError: error instanceof Error ? error.message : 'ファイル取込に失敗しました。',
			actionSuccess: ''
		};
	}
}

/**
 * タスク操作アクションを実行し、画面メッセージを返します。
 *
 * 失敗時メッセージの反映ルール（成功時は空、失敗時は error）を
 * 1 箇所に固定して UI 実装の重複を防ぎます。
 */
export async function runTaskActionWorkflow(
	action: () => Promise<string | null>
): Promise<TaskActionWorkflowResult> {
	const error = await action();
	const hasError = error !== null;
	const kind = TASK_ACTION_KIND_BY_HAS_ERROR[String(hasError) as 'true' | 'false'];
	return TASK_ACTION_RESULT_BY_KIND[kind](error);
}

/**
 * タスク並び替えワークフローを実行します。
 *
 * 入力検証・ID並び替え計算・保存アクションを集約し、
 * ルート側を結果適用のみに保つために定義しています。
 */
export async function runReorderTasksWorkflow(params: {
	store: Pick<GanttTasksStore, 'reorder'>;
	projectId: string;
	orderedTasks: Task[];
	sourceTaskId: string;
	targetTaskId: string;
}): Promise<ReorderTasksWorkflowResult> {
	if (!params.projectId) {
		return {
			kind: 'error',
			actionError: 'プロジェクトを選択してください。',
			actionSuccess: ''
		};
	}

	const reorderedIds = reorderTaskIds(
		params.orderedTasks,
		params.sourceTaskId,
		params.targetTaskId
	);
	if (!reorderedIds || reorderedIds.length === 0) {
		return {
			kind: 'noop'
		};
	}

	const feedback = await runTaskActionWorkflow(() =>
		reorderTasksAction({
			store: params.store,
			projectId: params.projectId,
			ids: reorderedIds
		})
	);
	return handleResultByKind(feedback, {
		error: (next) => {
			return {
				kind: 'error',
				actionError: next.actionError,
				actionSuccess: ''
			};
		},
		ok: () => {
			return {
				kind: 'ok',
				actionError: '',
				actionSuccess: '',
				selectedTaskId: params.sourceTaskId
			};
		}
	});
}

/**
 * タスク出力ワークフローを実行します。
 *
 * 事前条件の検証と出力処理の例外整形を集約し、
 * ルート側を状態反映のみに保つために定義しています。
 */
export async function runTaskExportWorkflow(params: {
	format: ExportFormat;
	projectId: string;
	projectName: string;
	tasks: readonly Task[];
	users: readonly User[];
	isBrowser: boolean;
}): Promise<ExportTasksWorkflowResult> {
	if (!params.projectId) {
		return {
			kind: 'error',
			actionError: 'プロジェクトを選択してください。'
		};
	}
	if (params.tasks.length === 0) {
		return {
			kind: 'error',
			actionError: '出力対象のタスクがありません。'
		};
	}
	if (!params.isBrowser) {
		return {
			kind: 'noop'
		};
	}

	try {
		await EXPORT_TASK_STRATEGIES[params.format]({
			projectId: params.projectId,
			projectName: params.projectName,
			tasks: params.tasks,
			users: params.users
		});
		return {
			kind: 'ok'
		};
	} catch (error) {
		return {
			kind: 'error',
			actionError: error instanceof Error ? error.message : 'ファイル出力に失敗しました。'
		};
	}
}

/**
 * 選択中タスクの削除ワークフローを実行します。
 *
 * 選択状態確認・確認ダイアログ判定・削除アクションを集約し、
 * 画面側の分岐を減らすために定義しています。
 */
export async function runDeleteSelectedTaskWorkflow(params: {
	store: Pick<GanttTasksStore, 'remove'>;
	projectId: string;
	targetTask: Task | null;
	isBrowser: boolean;
	confirmDelete: (taskTitle: string) => boolean;
}): Promise<DeleteSelectedTaskWorkflowResult> {
	const targetTask = params.targetTask;
	if (!targetTask || !params.isBrowser) {
		return {
			kind: 'noop'
		};
	}
	const confirmed = params.confirmDelete(targetTask.title);
	if (!confirmed) {
		return {
			kind: 'noop'
		};
	}

	const feedback = await runTaskActionWorkflow(() =>
		runDeleteTaskWorkflow({
			store: params.store,
			projectId: params.projectId,
			taskId: targetTask.id
		})
	);
	return handleResultByKind(feedback, {
		error: (next) => {
			return {
				kind: 'error',
				actionError: next.actionError,
				actionSuccess: ''
			};
		},
		ok: () => {
			return {
				kind: 'ok',
				actionError: '',
				actionSuccess: ''
			};
		}
	});
}

/**
 * 不足担当者の作成とメンバー反映を行い、取込計画を再構築します。
 *
 * 担当者作成・メンバー更新・再計画という複合処理を 1 つのワークフローに集約し、
 * ルート側の状態遷移を単純化するために定義しています。
 */
export async function runResolveMissingAssigneesWorkflow(params: {
	projectId: string;
	rows: readonly TaskImportRow[] | null;
	missingAssigneeNames: readonly string[];
	users: readonly User[];
	projectMembers: readonly User[];
	existingTaskIds: ReadonlySet<string>;
	createUser: (input: CreateUserInput) => Promise<User>;
	setProjectMembers: (projectId: string, userIds: string[]) => Promise<User[]>;
	reloadProject: (projectId: string) => Promise<unknown>;
}): Promise<ResolveMissingAssigneesWorkflowResult> {
	const rows = params.rows;
	if (!rows || params.missingAssigneeNames.length === 0) {
		return { kind: 'noop' };
	}
	if (!params.projectId) {
		return {
			kind: 'error',
			actionError: 'プロジェクトを選択してください。',
			actionSuccess: ''
		};
	}

	try {
		const uniqueMissingNames = [
			...new Set(params.missingAssigneeNames.map((name) => name.trim()).filter(Boolean))
		];
		const existingUserByName = new Map(
			params.users.map((user) => [user.name.trim(), user] as const)
		);
		const knownUsersToAdd: User[] = [];
		const namesToCreate: string[] = [];
		for (const name of uniqueMissingNames) {
			const existingUser = existingUserByName.get(name);
			if (existingUser) {
				knownUsersToAdd.push(existingUser);
			} else {
				namesToCreate.push(name);
			}
		}

		let createdUsers: User[] = [];
		if (namesToCreate.length > 0) {
			const createResult = await createMissingUsersAction({
				missingNames: namesToCreate,
				createUser: params.createUser
			});
			if (createResult.kind === 'error') {
				return {
					kind: 'error',
					actionError: createResult.message,
					actionSuccess: ''
				};
			}
			createdUsers = createResult.createdUsers;
		}

		const usersToAddAsMembers = mergeUsersById(knownUsersToAdd, createdUsers);
		if (usersToAddAsMembers.length > 0) {
			const nextProjectMemberIds = [
				...new Set([
					...params.projectMembers.map((member) => member.id),
					...usersToAddAsMembers.map((member) => member.id)
				])
			];
			await params.setProjectMembers(params.projectId, nextProjectMemberIds);
			await params.reloadProject(params.projectId);
		}

		const projectUsersForPlan = mergeUsersById(params.projectMembers, usersToAddAsMembers);
		const plan = planTaskImportDrafts({
			rows,
			users: projectUsersForPlan,
			existingTaskIds: params.existingTaskIds,
			allowMissingAssignees: false
		});
		if (plan.kind !== 'ready') {
			throw new TaskImportContractError('担当者解決後の取込計画に失敗しました。');
		}

		return {
			kind: 'ready',
			projectId: params.projectId,
			drafts: plan.drafts,
			createdUsersCount: createdUsers.length
		};
	} catch (error) {
		if (error instanceof TaskImportContractError) {
			return {
				kind: 'error',
				actionError: error.message,
				actionSuccess: ''
			};
		}
		return {
			kind: 'error',
			actionError: error instanceof Error ? error.message : 'ユーザー作成に失敗しました。',
			actionSuccess: ''
		};
	}
}

/**
 * タスク削除ワークフローを実行します。
 *
 * プロジェクト選択チェックと削除アクション呼び出しを統一し、
 * ルート側から直接ユースケース詳細を隠蔽するために定義しています。
 */
export function runDeleteTaskWorkflow(params: {
	store: Pick<GanttTasksStore, 'remove'>;
	projectId: string;
	taskId: string;
}): Promise<string | null> {
	if (!params.projectId) {
		return Promise.resolve('プロジェクトを選択してください。');
	}
	return deleteTaskAction({
		store: params.store,
		projectId: params.projectId,
		taskId: params.taskId
	});
}

/**
 * タスク期間更新ワークフローを実行します。
 *
 * 事前条件（プロジェクト選択・対象タスク存在）と更新アクション実行をまとめ、
 * 日付更新時の状態遷移を一貫させるために定義しています。
 */
export function runCommitTaskDateRangeWorkflow(params: {
	store: Pick<GanttTasksStore, 'update'>;
	projectId: string;
	taskId: string;
	startDate: string;
	endDate: string;
	sourceTask: Task | null;
}): Promise<CommitTaskDateRangeWorkflowResult> {
	if (!params.projectId) {
		return Promise.resolve({
			kind: 'error',
			actionError: 'プロジェクトを選択してください。',
			actionSuccess: ''
		});
	}
	if (!params.sourceTask) {
		return Promise.resolve({
			kind: 'error',
			actionError: '更新対象のタスクが見つかりません。',
			actionSuccess: ''
		});
	}
	return commitTaskDateRangeAction({
		store: params.store,
		projectId: params.projectId,
		taskId: params.taskId,
		startDate: params.startDate,
		endDate: params.endDate,
		updatedAt: params.sourceTask.updatedAt
	}).then((result: CommitTaskDateRangeResult) =>
		handleResultByKind(result, {
			error: (next) => {
				return {
					kind: 'error',
					actionError: next.message,
					actionSuccess: ''
				};
			},
			ok: (next) => {
				return {
					kind: 'ok',
					actionError: '',
					actionSuccess: '',
					task: next.task
				};
			}
		})
	);
}

/**
 * タスクインポートアクションを実行し、UI 適用用の結果を返します。
 *
 * 成功メッセージの組み立てと失敗時メッセージの扱いを分離し、
 * `+page.svelte` 側の状態遷移コードを短く保つために定義しています。
 */
export async function runTaskImportWorkflow(params: {
	store: Pick<GanttTasksStore, 'create' | 'update'>;
	projectId: string;
	drafts: readonly TaskImportDraft[];
	createdUsersCount?: number;
}): Promise<
	| { kind: 'error'; actionError: string }
	| { kind: 'ok'; actionSuccess: string; selectedTaskId: null; clearPendingImport: true }
> {
	const result = await importTasksAction({
		store: params.store,
		projectId: params.projectId,
		drafts: params.drafts
	});
	const createdUsersCount = params.createdUsersCount ?? 0;
	return handleResultByKind(result, {
		error: (next) => {
			return {
				kind: 'error',
				actionError: next.message
			};
		},
		ok: (next) => {
			const modeByHasCreatedUsers: Record<'true' | 'false', ImportSuccessMessageMode> = {
				true: 'with_created_users',
				false: 'without_created_users'
			};
			const hasCreatedUsers = createdUsersCount > 0;
			const successMode = modeByHasCreatedUsers[String(hasCreatedUsers) as 'true' | 'false'];
			return {
				kind: 'ok',
				actionSuccess: IMPORT_SUCCESS_MESSAGE_BY_MODE[successMode](
					next.importedCount,
					createdUsersCount
				),
				selectedTaskId: null,
				clearPendingImport: true
			};
		}
	});
}

/**
 * ユーザー配列を ID でマージします。
 *
 * 既存ユーザーと新規作成ユーザーを重複なく統合するために使います。
 */
export function mergeUsersById(baseUsers: readonly User[], extraUsers: readonly User[]): User[] {
	const mergedById: Record<string, User> = {};
	for (const user of baseUsers) {
		mergedById[user.id] = user;
	}
	for (const user of extraUsers) {
		mergedById[user.id] = user;
	}
	return Object.values(mergedById);
}
