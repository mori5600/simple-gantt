/**
 * `+page.svelte` の副作用適用（effect）を集約するモジュールです。
 *
 * ルート側の `$effect` 本文をこのファクトリへ移し、
 * 画面を「状態宣言と UI 配線」に集中させるために定義しています。
 */

import type { Task, User } from '$lib/data/tasks/repo';
import { UNASSIGNED_ASSIGNEE, type TaskFilters } from './filterStorage';
import { persistSelectedProject, persistTaskFilters } from './lifecycle';
import { computeAutoColumnWidths } from './listColumns';
import { ensureSelectedTaskId, trimTaskDatePreviews } from './state';
import type { ListColumnWidths, TaskDateRange } from './types';

/**
 * 副作用処理が参照する状態スナップショットです。
 */
export type GanttPageEffectsSnapshot = {
	visibleTasks: Task[];
	selectedTaskId: string | null;
	isListColumnAuto: boolean;
	orderedTasks: Task[];
	projectMembers: User[];
	taskFilters: TaskFilters;
	hasActiveFilters: boolean;
	isFilterStorageReady: boolean;
	isProjectStorageReady: boolean;
	selectedProjectId: string;
	taskDatePreviews: Record<string, TaskDateRange>;
};

/**
 * 副作用処理が参照・更新する状態インターフェースです。
 */
export type GanttPageEffectsState = {
	read: () => GanttPageEffectsSnapshot;
	setSelectedTaskId: (taskId: string | null) => void;
	setListColumnWidths: (widths: ListColumnWidths) => void;
	setTaskFilters: (filters: TaskFilters) => void;
	setTaskDatePreviews: (previews: Record<string, TaskDateRange>) => void;
};

/**
 * 永続化に必要な設定です。
 */
export type GanttPageEffectsStorage = {
	getStorage: () => Storage | undefined;
	filtersStorageKey: string;
	projectStorageKey: string;
};

/**
 * `+page.svelte` から呼び出す副作用ハンドラ群です。
 */
export type GanttPageEffects = {
	syncSelectedTask: () => void;
	syncAutoListColumns: () => void;
	persistTaskFilters: () => void;
	persistSelectedProject: () => void;
	sanitizeAssigneeFilter: () => void;
	trimTaskDatePreviews: () => void;
};

/**
 * ガント画面の副作用ハンドラ群を生成します。
 *
 * @param params 状態アクセスと永続化設定
 * @returns `$effect` から直接呼び出せる関数群
 */
export function createGanttPageEffects(params: {
	state: GanttPageEffectsState;
	storage: GanttPageEffectsStorage;
}): GanttPageEffects {
	const { state, storage } = params;

	return {
		syncSelectedTask(): void {
			const snapshot = state.read();
			const nextSelectedTaskId = ensureSelectedTaskId(
				snapshot.visibleTasks,
				snapshot.selectedTaskId
			);
			if (nextSelectedTaskId !== snapshot.selectedTaskId) {
				state.setSelectedTaskId(nextSelectedTaskId);
			}
		},

		syncAutoListColumns(): void {
			const snapshot = state.read();
			if (!snapshot.isListColumnAuto) {
				return;
			}
			state.setListColumnWidths(
				computeAutoColumnWidths(snapshot.orderedTasks, snapshot.projectMembers)
			);
		},

		persistTaskFilters(): void {
			const snapshot = state.read();
			persistTaskFilters({
				storage: storage.getStorage(),
				isStorageReady: snapshot.isFilterStorageReady,
				storageKey: storage.filtersStorageKey,
				filters: snapshot.taskFilters,
				hasActiveFilters: snapshot.hasActiveFilters
			});
		},

		persistSelectedProject(): void {
			const snapshot = state.read();
			persistSelectedProject({
				storage: storage.getStorage(),
				isStorageReady: snapshot.isProjectStorageReady,
				storageKey: storage.projectStorageKey,
				projectId: snapshot.selectedProjectId
			});
		},

		sanitizeAssigneeFilter(): void {
			const snapshot = state.read();
			const assigneeId = snapshot.taskFilters.assignee.trim();
			if (!assigneeId || assigneeId === UNASSIGNED_ASSIGNEE) {
				return;
			}
			if (!snapshot.projectMembers.some((user) => user.id === assigneeId)) {
				state.setTaskFilters({
					...snapshot.taskFilters,
					assignee: ''
				});
			}
		},

		trimTaskDatePreviews(): void {
			const snapshot = state.read();
			const nextPreviews = trimTaskDatePreviews(snapshot.taskDatePreviews, snapshot.visibleTasks);
			if (nextPreviews !== snapshot.taskDatePreviews) {
				state.setTaskDatePreviews(nextPreviews);
			}
		}
	};
}
