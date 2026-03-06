/**
 * `+page.svelte` の表示・ローカル UI 操作に関するバインディングを集約するモジュールです。
 *
 * ルートファイルから単純なハンドラ定義を分離し、UI 配線を読みやすく保つために定義しています。
 */

import type { Task, User } from '$lib/data/tasks/repo';
import {
	hasDependencyViolation,
	resolveTaskAssigneeNames,
	resolveTaskAssigneeSummary,
	resolveTaskDisplayEnd,
	resolveTaskDisplayStart
} from './state';
import { computeAutoColumnWidths, normalizeListColumnWidths } from './listColumns';
import type { TaskFilters } from './filterStorage';
import type { ListColumnWidths, TaskDateRange, ZoomLevel } from './types';

/**
 * 表示バインディングが参照するスナップショットです。
 */
export type GanttPageViewSnapshot = {
	assigneeNamesByTaskId: Record<string, string[]>;
	orderedTasks: Task[];
	projectMembers: User[];
	taskDatePreviews: Record<string, TaskDateRange>;
	taskById: ReadonlyMap<string, Task>;
};

/**
 * 表示バインディングが参照・更新する状態インターフェースです。
 */
export type GanttPageViewState = {
	read: () => GanttPageViewSnapshot;
	setIsListColumnAuto: (isAuto: boolean) => void;
	setListColumnWidths: (widths: ListColumnWidths) => void;
	setSelectedTaskId: (taskId: string) => void;
	setTaskFilters: (filters: TaskFilters) => void;
	setZoom: (zoom: ZoomLevel) => void;
};

/**
 * 画面にバインドする表示系ハンドラ群です。
 */
export type GanttPageViewBindings = {
	setZoom: (nextZoom: ZoomLevel) => void;
	resetFilters: () => void;
	setListColumnWidths: (nextWidths: ListColumnWidths) => void;
	autoFitListColumns: () => void;
	selectTask: (taskId: string) => void;
	getAssigneeNames: (task: Task) => string[];
	getAssigneeSummary: (task: Task) => string;
	hasDependencyViolation: (task: Task) => boolean;
	getDisplayStart: (task: Task) => string;
	getDisplayEnd: (task: Task) => string;
};

/**
 * 画面表示バインディングを生成します。
 *
 * @param params 状態アクセスと既定フィルタ
 * @returns `+page.svelte` に直接バインドできる関数群
 */
export function createGanttPageViewBindings(params: {
	state: GanttPageViewState;
	defaultTaskFilters: Readonly<TaskFilters>;
}): GanttPageViewBindings {
	const { state, defaultTaskFilters } = params;

	return {
		setZoom(nextZoom: ZoomLevel): void {
			state.setZoom(nextZoom);
		},

		resetFilters(): void {
			state.setTaskFilters({ ...defaultTaskFilters });
		},

		setListColumnWidths(nextWidths: ListColumnWidths): void {
			state.setListColumnWidths(normalizeListColumnWidths(nextWidths));
			state.setIsListColumnAuto(false);
		},

		autoFitListColumns(): void {
			const snapshot = state.read();
			state.setIsListColumnAuto(true);
			state.setListColumnWidths(computeAutoColumnWidths(snapshot.orderedTasks, snapshot.projectMembers));
		},

		selectTask(taskId: string): void {
			state.setSelectedTaskId(taskId);
		},

		getAssigneeNames(task: Task): string[] {
			return resolveTaskAssigneeNames(state.read().assigneeNamesByTaskId, task.id);
		},

		getAssigneeSummary(task: Task): string {
			return resolveTaskAssigneeSummary(state.read().assigneeNamesByTaskId, task.id);
		},

		hasDependencyViolation(task: Task): boolean {
			return hasDependencyViolation(task, state.read().taskById);
		},

		getDisplayStart(task: Task): string {
			return resolveTaskDisplayStart(state.read().taskDatePreviews, task);
		},

		getDisplayEnd(task: Task): string {
			return resolveTaskDisplayEnd(state.read().taskDatePreviews, task);
		}
	};
}
