/**
 * ガント画面のライフサイクル関連処理を集約するモジュールです。
 *
 * `+page.svelte` から副作用処理（永続化、購読、ポーリング、初期化）を分離し、
 * ルートコンポーネントを配線と描画に集中させるために定義しています。
 */

import { startVisibilityPolling, type VisibilityPollingController } from '$lib/shared/polling';
import { resolvePollingIntervalForScope } from '$lib/shared/pollingSettings';
import type { Project, Task, User } from '$lib/data/tasks/repo';
import {
	loadInitialProjectAction,
	shouldEnableGanttSync,
	type GanttTasksStore,
	type InitializeProjectResult
} from './actions';
import { loadTaskFilters, saveTaskFilters, type TaskFilters } from './filterStorage';
import { loadSelectedProjectId, saveSelectedProjectId } from './projectStorage';
import { handleResultByKind } from './resultHandlers';

/**
 * ストア購読解除処理を表す関数型です。
 *
 * 複数購読の解除を同じシグネチャで束ねるために使います。
 */
type Unsubscribe = () => void;

/**
 * `subscribe` 可能な最小インターフェースです。
 *
 * Svelte の `Readable` 全体に依存せず、必要最小限の契約だけで
 * ライフサイクルヘルパーを扱えるようにするために定義しています。
 *
 * @typeParam T 購読対象の値の型
 */
type ReadableLike<T> = {
	subscribe: (run: (value: T) => void) => Unsubscribe;
};

/**
 * ガント画面で購読するストア群の契約です。
 *
 * タスク本体と補助データ（プロジェクト・ユーザー・メンバー）を
 * 一括で受け取れるようにして、購読開始/解除の重複実装を防ぎます。
 */
export type GanttStoreSubscriptions = {
	subscribe: ReadableLike<Task[]>['subscribe'];
	projects: ReadableLike<Project[]>;
	users: ReadableLike<User[]>;
	projectMembers: ReadableLike<User[]>;
};

/**
 * ガント画面の初期マウント処理に必要な依存・コールバック群です。
 *
 * `+page.svelte` から初期化手順を分離し、画面側の責務を
 * 「状態反映」と「描画」に限定するための入力契約です。
 */
export type MountGanttPageLifecycleParams = {
	store: Pick<GanttTasksStore, 'loadProjects' | 'load'> & GanttStoreSubscriptions;
	refreshProject: (projectId: string) => Promise<unknown>;
	filtersStorageKey: string;
	projectStorageKey: string;
	defaultSyncPollIntervalMs: number;
	getSyncState: () => {
		selectedProjectId: string;
		isSubmitting: boolean;
		isInitialized: boolean;
	};
	onTaskFiltersRestored: (filters: TaskFilters) => void;
	onStorageReady: () => void;
	onTasks: (tasks: Task[]) => void;
	onProjects: (projects: Project[]) => void;
	onUsers: (users: User[]) => void;
	onProjectMembers: (members: User[]) => void;
	onSyncError: (message: string) => void;
	onInitializeSuccess: (projectId: string) => void;
	onInitializeError: (message: string) => void;
};

/**
 * 永続化済みのガント状態を復元します。
 *
 * 初期表示時に必要な復元処理を 1 箇所へ集約し、ルート側が
 * ストレージキーや読み込み順序の詳細を持たないようにするために存在します。
 *
 * @param params 復元に必要なストレージと各キー
 * @returns 復元したフィルタ条件と選択プロジェクト ID
 */
export function restorePersistedGanttState(params: {
	storage: Storage;
	filtersStorageKey: string;
	projectStorageKey: string;
}): { filters: TaskFilters; projectId: string } {
	const { storage, filtersStorageKey, projectStorageKey } = params;
	return {
		filters: loadTaskFilters(storage, filtersStorageKey),
		projectId: loadSelectedProjectId(storage, projectStorageKey)
	};
}

/**
 * ガント画面で使う複数ストアの購読を開始し、解除関数を 1 つ返します。
 *
 * 画面側で購読解除漏れを起こさないよう、解除処理を単一のクロージャへ
 * まとめるために定義しています。
 *
 * @param params 購読対象ストアと各値更新時のハンドラ
 * @returns すべての購読を解除する関数
 */
export function subscribeToGanttStore(params: {
	store: GanttStoreSubscriptions;
	onTasks: (tasks: Task[]) => void;
	onProjects: (projects: Project[]) => void;
	onUsers: (users: User[]) => void;
	onProjectMembers: (members: User[]) => void;
}): Unsubscribe {
	const { store, onTasks, onProjects, onUsers, onProjectMembers } = params;

	const unsubscribeTasks = store.subscribe(onTasks);
	const unsubscribeProjects = store.projects.subscribe(onProjects);
	const unsubscribeUsers = store.users.subscribe(onUsers);
	const unsubscribeProjectMembers = store.projectMembers.subscribe(onProjectMembers);

	return () => {
		unsubscribeTasks();
		unsubscribeProjects();
		unsubscribeUsers();
		unsubscribeProjectMembers();
	};
}

/**
 * ガント同期用の可視状態ポーリングを作成します。
 *
 * ポーリング間隔の解決と開始処理をここに閉じ込めることで、
 * ルート側の条件分岐を減らし、設定変更時の影響範囲を限定します。
 *
 * @param params 間隔、有効条件、ポーリング処理、エラーハンドラ
 * @returns ポーリング制御オブジェクト。設定で無効の場合は `null`
 */
export function createGanttSyncPolling(params: {
	defaultIntervalMs: number;
	storage: Storage | undefined;
	isEnabled: () => boolean;
	onPoll: () => Promise<void> | void;
	onError: (error: unknown) => void;
}): VisibilityPollingController | null {
	const syncPollIntervalMs = resolvePollingIntervalForScope({
		scope: 'gantt',
		defaultIntervalMs: params.defaultIntervalMs,
		storage: params.storage
	});
	if (syncPollIntervalMs === null) {
		return null;
	}
	return startVisibilityPolling({
		intervalMs: syncPollIntervalMs,
		isEnabled: params.isEnabled,
		onPoll: params.onPoll,
		onError: params.onError
	});
}

/**
 * 初期プロジェクトの選定とロードを実行します。
 *
 * 初期化方針は `actions.ts` に寄せたまま、ルート側では
 * ライフサイクル API として扱えるようにする薄い委譲関数です。
 *
 * @param params ストアと復元済みプロジェクト ID
 * @returns 初期化結果（成功・空・失敗）
 */
export function initializeGanttProject(params: {
	store: Pick<GanttTasksStore, 'loadProjects' | 'load'>;
	storedProjectId: string;
}): Promise<InitializeProjectResult> {
	return loadInitialProjectAction(params);
}

/**
 * ガント画面の初期マウント処理（復元・購読・同期・初期ロード）を開始します。
 *
 * 画面で分散しやすい初期化フローを 1 関数にまとめ、
 * `onMount` を短く保つために定義しています。
 *
 * @param params 初期化に必要な依存と状態反映コールバック
 * @returns 画面アンマウント時に呼ぶ解除関数
 */
export function mountGanttPageLifecycle(params: MountGanttPageLifecycleParams): Unsubscribe {
	const browserStorage = typeof localStorage === 'undefined' ? undefined : localStorage;
	let storedProjectId = '';
	if (browserStorage) {
		const restored = restorePersistedGanttState({
			storage: browserStorage,
			filtersStorageKey: params.filtersStorageKey,
			projectStorageKey: params.projectStorageKey
		});
		params.onTaskFiltersRestored(restored.filters);
		storedProjectId = restored.projectId;
	}
	params.onStorageReady();

	const unsubscribeStore = subscribeToGanttStore({
		store: params.store,
		onTasks: params.onTasks,
		onProjects: params.onProjects,
		onUsers: params.onUsers,
		onProjectMembers: params.onProjectMembers
	});

	const syncPolling = createGanttSyncPolling({
		defaultIntervalMs: params.defaultSyncPollIntervalMs,
		storage: browserStorage,
		isEnabled: () => {
			const syncState = params.getSyncState();
			return shouldEnableGanttSync({
				selectedProjectId: syncState.selectedProjectId,
				isSubmitting: syncState.isSubmitting,
				isInitialized: syncState.isInitialized
			});
		},
		onPoll: async () => {
			const { selectedProjectId } = params.getSyncState();
			if (!selectedProjectId) {
				return;
			}
			await params.refreshProject(selectedProjectId);
		},
		onError: (error) => {
			params.onSyncError(error instanceof Error ? error.message : '同期に失敗しました。');
		}
	});

	void initializeGanttProject({
		store: params.store,
		storedProjectId
	})
		.then((result) =>
			handleResultByKind(result, {
				ok: (next) => {
					params.onInitializeSuccess(next.projectId);
				},
				empty: (next) => {
					params.onInitializeError(next.message);
				},
				error: (next) => {
					params.onInitializeError(next.message);
				}
			})
		)
		.catch((error) => {
			params.onInitializeError(
				error instanceof Error ? error.message : '初期データの読み込みに失敗しました。'
			);
		});

	return () => {
		syncPolling?.stop();
		unsubscribeStore();
	};
}

/**
 * フィルタ状態を永続化します。
 *
 * ストレージ準備前や非ブラウザ環境での不要な書き込みを避けるため、
 * 実行ガードを共通化した関数として分離しています。
 *
 * @param params ストレージ状態、キー、保存対象フィルタ、アクティブ判定
 */
export function persistTaskFilters(params: {
	storage: Storage | undefined;
	isStorageReady: boolean;
	storageKey: string;
	filters: TaskFilters;
	hasActiveFilters: boolean;
}): void {
	if (!params.isStorageReady || !params.storage) {
		return;
	}
	saveTaskFilters(params.storage, params.storageKey, params.filters, params.hasActiveFilters);
}

/**
 * 選択中プロジェクト ID を永続化します。
 *
 * フィルタ永続化と同じガード方針を適用し、保存ロジックの分散を防ぐために
 * 専用関数として定義しています。
 *
 * @param params ストレージ状態、キー、保存対象プロジェクト ID
 */
export function persistSelectedProject(params: {
	storage: Storage | undefined;
	isStorageReady: boolean;
	storageKey: string;
	projectId: string;
}): void {
	if (!params.isStorageReady || !params.storage) {
		return;
	}
	saveSelectedProjectId(params.storage, params.storageKey, params.projectId);
}
