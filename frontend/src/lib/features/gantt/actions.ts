import type { CreateTaskInput, Project, Task, UpdateTaskInput, User } from '$lib/tasksRepo';
import type { TaskImportDraft } from './import';
export type { TaskImportDraft } from './import';

export type ModalMode = 'create' | 'edit';

export type GanttTasksStore = {
	loadProjects: () => Promise<Project[]>;
	load: (projectId: string) => Promise<Task[]>;
	create: (projectId: string, input: CreateTaskInput) => Promise<Task>;
	update: (projectId: string, id: string, input: UpdateTaskInput) => Promise<Task>;
	remove: (projectId: string, id: string) => Promise<void>;
	reorder: (projectId: string, ids: string[]) => Promise<Task[]>;
};

export type InitializeProjectResult =
	| { kind: 'ok'; projectId: string }
	| { kind: 'empty'; message: string }
	| { kind: 'error'; message: string };

export type SubmitTaskResult =
	| { kind: 'ok'; selectedTaskId: string }
	| { kind: 'error'; message: string };

export type ChangeProjectSelectionResult =
	| { kind: 'noop'; projectId: string }
	| { kind: 'ok'; projectId: string }
	| { kind: 'error'; projectId: string; message: string };

export type ImportTasksResult =
	| { kind: 'ok'; importedCount: number }
	| { kind: 'error'; message: string };

export type CreateMissingUsersResult =
	| { kind: 'ok'; createdUsers: User[]; createdCount: number }
	| { kind: 'error'; message: string };

function toErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

export async function loadInitialProjectAction(params: {
	store: Pick<GanttTasksStore, 'loadProjects' | 'load'>;
	storedProjectId: string;
}): Promise<InitializeProjectResult> {
	const { store, storedProjectId } = params;

	try {
		const availableProjects = await store.loadProjects();
		if (availableProjects.length === 0) {
			return {
				kind: 'empty',
				message: '利用可能なプロジェクトがありません。'
			};
		}

		const initialProjectId = availableProjects.some((project) => project.id === storedProjectId)
			? storedProjectId
			: availableProjects[0].id;

		await store.load(initialProjectId);

		return {
			kind: 'ok',
			projectId: initialProjectId
		};
	} catch (error) {
		return {
			kind: 'error',
			message: toErrorMessage(error, '初期データの読み込みに失敗しました。')
		};
	}
}

export async function changeProjectSelectionAction(params: {
	store: Pick<GanttTasksStore, 'load'>;
	currentProjectId: string;
	nextProjectId: string;
}): Promise<ChangeProjectSelectionResult> {
	const { store, currentProjectId, nextProjectId } = params;
	if (!nextProjectId || nextProjectId === currentProjectId) {
		return {
			kind: 'noop',
			projectId: currentProjectId
		};
	}

	try {
		await store.load(nextProjectId);
		return {
			kind: 'ok',
			projectId: nextProjectId
		};
	} catch (error) {
		return {
			kind: 'error',
			projectId: currentProjectId,
			message: toErrorMessage(error, 'プロジェクトの切替に失敗しました。')
		};
	}
}

export function shouldEnableGanttSync(params: {
	selectedProjectId: string;
	isSubmitting: boolean;
	isInitialized: boolean;
}): boolean {
	return params.isInitialized && params.selectedProjectId.length > 0 && !params.isSubmitting;
}

export async function reorderTasksAction(params: {
	store: Pick<GanttTasksStore, 'reorder'>;
	projectId: string;
	ids: string[];
}): Promise<string | null> {
	try {
		await params.store.reorder(params.projectId, params.ids);
		return null;
	} catch (error) {
		return toErrorMessage(error, '行の並び替えに失敗しました。');
	}
}

export async function submitTaskAction(params: {
	store: Pick<GanttTasksStore, 'create' | 'update'>;
	mode: ModalMode;
	projectId: string;
	createInput: CreateTaskInput;
	editingTaskId: string | null;
	sourceTask: Task | null;
}): Promise<SubmitTaskResult> {
	const { store, mode, projectId, createInput, editingTaskId, sourceTask } = params;

	try {
		if (mode === 'create') {
			const created = await store.create(projectId, createInput);
			return {
				kind: 'ok',
				selectedTaskId: created.id
			};
		}

		if (!editingTaskId || !sourceTask) {
			return {
				kind: 'error',
				message: '編集対象のタスクが見つかりません。'
			};
		}

		const updatePayload: UpdateTaskInput = {
			...createInput,
			updatedAt: sourceTask.updatedAt
		};
		const updated = await store.update(projectId, editingTaskId, updatePayload);
		return {
			kind: 'ok',
			selectedTaskId: updated.id
		};
	} catch (error) {
		return {
			kind: 'error',
			message: toErrorMessage(error, '保存に失敗しました。')
		};
	}
}

export async function deleteTaskAction(params: {
	store: Pick<GanttTasksStore, 'remove'>;
	projectId: string;
	taskId: string;
}): Promise<string | null> {
	try {
		await params.store.remove(params.projectId, params.taskId);
		return null;
	} catch (error) {
		return toErrorMessage(error, '削除に失敗しました。');
	}
}

export async function commitTaskDateRangeAction(params: {
	store: Pick<GanttTasksStore, 'update'>;
	projectId: string;
	taskId: string;
	startDate: string;
	endDate: string;
	updatedAt: string;
}): Promise<string | null> {
	try {
		await params.store.update(params.projectId, params.taskId, {
			startDate: params.startDate,
			endDate: params.endDate,
			updatedAt: params.updatedAt
		});
		return null;
	} catch (error) {
		return toErrorMessage(error, 'タスク期間の更新に失敗しました。');
	}
}

export async function importTasksAction(params: {
	store: Pick<GanttTasksStore, 'create' | 'update'>;
	projectId: string;
	drafts: readonly TaskImportDraft[];
}): Promise<ImportTasksResult> {
	const { store, projectId, drafts } = params;

	if (projectId.trim().length === 0) {
		return {
			kind: 'error',
			message: 'プロジェクトを選択してください。'
		};
	}
	if (drafts.length === 0) {
		return {
			kind: 'error',
			message: '取込対象のタスクがありません。'
		};
	}

	type CreatedRow = {
		draft: TaskImportDraft;
		createdTask: Task;
	};

	try {
		const createdRows: CreatedRow[] = [];
		const createdBySourceId = new Map<string, Task>();

		for (const draft of drafts) {
			const createdTask = await store.create(projectId, draft.createInput);
			createdRows.push({
				draft,
				createdTask
			});
			if (draft.sourceTaskId) {
				createdBySourceId.set(draft.sourceTaskId, createdTask);
			}
		}

		for (const row of createdRows) {
			const predecessorId = row.draft.predecessorSourceTaskId;
			if (!predecessorId) {
				continue;
			}
			const predecessorTaskId = createdBySourceId.get(predecessorId)?.id ?? predecessorId;
			const updatedTask = await store.update(projectId, row.createdTask.id, {
				updatedAt: row.createdTask.updatedAt,
				predecessorTaskId
			});
			row.createdTask = updatedTask;
			if (row.draft.sourceTaskId) {
				createdBySourceId.set(row.draft.sourceTaskId, updatedTask);
			}
		}

		return {
			kind: 'ok',
			importedCount: createdRows.length
		};
	} catch (error) {
		return {
			kind: 'error',
			message: toErrorMessage(error, 'タスク取込に失敗しました。')
		};
	}
}

export async function createMissingUsersAction(params: {
	missingNames: readonly string[];
	createUser: (input: { name: string }) => Promise<User>;
}): Promise<CreateMissingUsersResult> {
	const uniqueNames = [...new Set(params.missingNames.map((name) => name.trim()).filter(Boolean))];
	if (uniqueNames.length === 0) {
		return {
			kind: 'ok',
			createdUsers: [],
			createdCount: 0
		};
	}

	try {
		const createdUsers: User[] = [];
		for (const name of uniqueNames) {
			createdUsers.push(await params.createUser({ name }));
		}
		return {
			kind: 'ok',
			createdUsers,
			createdCount: createdUsers.length
		};
	} catch (error) {
		return {
			kind: 'error',
			message: toErrorMessage(error, 'ユーザー作成に失敗しました。')
		};
	}
}
