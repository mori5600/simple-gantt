<script lang="ts">
	import { onMount } from 'svelte';
	import GanttTimelinePane from '$lib/components/gantt/GanttTimelinePane.svelte';
	import GanttToolbar from '$lib/components/gantt/GanttToolbar.svelte';
	import TaskFiltersBar from '$lib/components/gantt/TaskFiltersBar.svelte';
	import TaskListPane from '$lib/components/gantt/TaskListPane.svelte';
	import TaskModal from '$lib/components/gantt/TaskModal.svelte';
	import { addDays, toIsoDate } from '$lib/features/gantt/date';
	import { exportTasksAsCsv, exportTasksAsXlsx } from '$lib/features/gantt/export';
	import {
		changeProjectSelectionAction,
		commitTaskDateRangeAction,
		deleteTaskAction,
		loadInitialProjectAction,
		type ModalMode,
		reorderTasksAction,
		shouldEnableGanttSync,
		submitTaskAction
	} from '$lib/features/gantt/actions';
	import {
		loadTaskFilters,
		saveTaskFilters,
		type TaskFilters
	} from '$lib/features/gantt/filterStorage';
	import { loadSelectedProjectId, saveSelectedProjectId } from '$lib/features/gantt/projectStorage';
	import {
		computeAutoColumnWidths,
		getAssigneeNames as resolveAssigneeNames,
		getAssigneeSummary as resolveAssigneeSummary,
		LIST_COLUMN_DEFAULT_WIDTHS,
		normalizeListColumnWidths
	} from '$lib/features/gantt/listColumns';
	import {
		ensureSelectedTaskId,
		filterTasksByFilters,
		hasActiveTaskFilters,
		hasDependencyViolation as hasTaskDependencyViolation,
		indexTasksById,
		orderTasksForDisplay,
		reorderTaskIds,
		type TaskFormInput,
		toCreateTaskInput,
		toggleAssignee,
		trimTaskDatePreviews,
		validateTaskForm
	} from '$lib/features/gantt/state';
	import { resolvePollIntervalMs, startVisibilityPolling } from '$lib/polling';
	import type { ListColumnWidths, TaskDateRange, ZoomLevel } from '$lib/features/gantt/types';
	import { tasksStore } from '$lib/tasksStore';
	import type { Project, Task, User } from '$lib/tasksRepo';

	const FILTERS_STORAGE_KEY = 'simple-gantt:task-filters:v1';
	const PROJECT_STORAGE_KEY = 'simple-gantt:selected-project:v1';
	const SYNC_POLL_INTERVAL_MS = resolvePollIntervalMs(
		15_000,
		'VITE_GANTT_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_GANTT_SYNC_POLL_INTERVAL_MS',
		'VITE_SYNC_POLL_INTERVAL_MS',
		'PUBLIC_SYNC_POLL_INTERVAL_MS'
	);
	const EMPTY_TASK_FORM: TaskFormInput = {
		title: '',
		note: '',
		startDate: '',
		endDate: '',
		progress: 0,
		assigneeIds: [],
		predecessorTaskId: ''
	};
	const DEFAULT_TASK_FILTERS: TaskFilters = {
		query: '',
		assignee: '',
		status: 'all',
		rangeStart: '',
		rangeEnd: ''
	};

	let tasks = $state<Task[]>([]);
	let projects = $state<Project[]>([]);
	let users = $state<User[]>([]);
	let selectedProjectId = $state('');
	let selectedTaskId = $state<string | null>(null);
	let zoom = $state<ZoomLevel>('day');
	let actionError = $state('');

	let isModalOpen = $state(false);
	let modalMode = $state<ModalMode>('create');
	let taskForm = $state<TaskFormInput>({ ...EMPTY_TASK_FORM });
	let editingTaskId = $state<string | null>(null);
	let formError = $state('');
	let isSubmitting = $state(false);
	let isExporting = $state(false);
	let listColumnWidths = $state<ListColumnWidths>([...LIST_COLUMN_DEFAULT_WIDTHS]);
	let isListColumnAuto = $state(true);

	let taskFilters = $state<TaskFilters>({ ...DEFAULT_TASK_FILTERS });
	let isFilterStorageReady = $state(false);
	let isProjectStorageReady = $state(false);
	let isInitialLoadCompleted = $state(false);

	let taskDatePreviews = $state<Record<string, TaskDateRange>>({});

	const orderedTasks = $derived.by(() => {
		return orderTasksForDisplay(tasks);
	});
	const selectedProject = $derived.by(() => {
		return projects.find((project) => project.id === selectedProjectId) ?? null;
	});
	const canExportTasks = $derived.by(() => {
		return selectedProjectId.length > 0 && orderedTasks.length > 0 && !isExporting;
	});

	const hasActiveFilters = $derived.by(() => {
		return hasActiveTaskFilters(taskFilters);
	});

	const visibleTasks = $derived.by(() => {
		return filterTasksByFilters(orderedTasks, taskFilters);
	});

	const selectedTask = $derived.by(() => {
		if (!selectedTaskId) {
			return null;
		}
		return visibleTasks.find((task) => task.id === selectedTaskId) ?? null;
	});
	const taskById = $derived.by(() => {
		return indexTasksById(orderedTasks);
	});

	const taskListPaneWidth = $derived(listColumnWidths.reduce((total, width) => total + width, 0));

	onMount(() => {
		const storedFilters = loadTaskFilters(localStorage, FILTERS_STORAGE_KEY);
		taskFilters = { ...storedFilters };
		isFilterStorageReady = true;
		const storedProjectId = loadSelectedProjectId(localStorage, PROJECT_STORAGE_KEY);
		isProjectStorageReady = true;

		const unsubscribeTasks = tasksStore.subscribe((nextTasks) => {
			tasks = nextTasks;
			selectedTaskId = ensureSelectedTaskId(nextTasks, selectedTaskId);
		});
		const unsubscribeProjects = tasksStore.projects.subscribe((nextProjects) => {
			projects = nextProjects;
		});
		const unsubscribeUsers = tasksStore.users.subscribe((nextUsers) => {
			users = nextUsers;
		});
		const syncPolling = startVisibilityPolling({
			intervalMs: SYNC_POLL_INTERVAL_MS,
			isEnabled: () =>
				shouldEnableGanttSync({
					selectedProjectId,
					isSubmitting,
					isInitialized: isInitialLoadCompleted
				}),
			onPoll: async () => {
				const projectId = selectedProjectId;
				if (!projectId) {
					return;
				}
				await tasksStore.load(projectId);
			},
			onError: (error) => {
				actionError = error instanceof Error ? error.message : '同期に失敗しました。';
			}
		});

		void (async () => {
			actionError = '';
			const result = await loadInitialProjectAction({
				store: tasksStore,
				storedProjectId
			});

			if (result.kind === 'ok') {
				selectedProjectId = result.projectId;
				isInitialLoadCompleted = true;
				return;
			}

			selectedProjectId = '';
			selectedTaskId = null;
			actionError = result.message;
			isInitialLoadCompleted = true;
		})();
		return () => {
			syncPolling.stop();
			unsubscribeTasks();
			unsubscribeProjects();
			unsubscribeUsers();
		};
	});

	$effect(() => {
		const nextSelectedTaskId = ensureSelectedTaskId(visibleTasks, selectedTaskId);
		if (nextSelectedTaskId !== selectedTaskId) {
			selectedTaskId = nextSelectedTaskId;
		}
	});

	$effect(() => {
		if (!isListColumnAuto) {
			return;
		}
		listColumnWidths = computeAutoColumnWidths(orderedTasks, users);
	});

	$effect(() => {
		if (!isFilterStorageReady || typeof localStorage === 'undefined') {
			return;
		}

		saveTaskFilters(localStorage, FILTERS_STORAGE_KEY, taskFilters, hasActiveFilters);
	});

	$effect(() => {
		if (!isProjectStorageReady || typeof localStorage === 'undefined') {
			return;
		}
		saveSelectedProjectId(localStorage, PROJECT_STORAGE_KEY, selectedProjectId);
	});

	$effect(() => {
		const nextPreviews = trimTaskDatePreviews(taskDatePreviews, visibleTasks);
		if (nextPreviews !== taskDatePreviews) {
			taskDatePreviews = nextPreviews;
		}
	});

	function setZoom(nextZoom: ZoomLevel): void {
		zoom = nextZoom;
	}

	async function changeProject(projectId: string): Promise<void> {
		const currentProjectId = selectedProjectId;
		if (!projectId || projectId === currentProjectId) {
			return;
		}
		actionError = '';

		const result = await changeProjectSelectionAction({
			store: tasksStore,
			currentProjectId,
			nextProjectId: projectId
		});
		if (result.kind === 'error') {
			actionError = result.message;
			selectedProjectId = result.projectId;
			return;
		}
		if (result.kind === 'noop') {
			return;
		}

		selectedProjectId = result.projectId;
		selectedTaskId = null;
		taskDatePreviews = {};
	}

	async function runTaskAction(action: () => Promise<string | null>): Promise<boolean> {
		actionError = '';
		const error = await action();
		if (!error) {
			return true;
		}
		actionError = error;
		return false;
	}

	async function exportTasks(format: 'csv' | 'xlsx'): Promise<void> {
		const projectId = selectedProjectId;
		if (!projectId) {
			actionError = 'プロジェクトを選択してください。';
			return;
		}
		if (orderedTasks.length === 0) {
			actionError = '出力対象のタスクがありません。';
			return;
		}
		if (typeof window === 'undefined') {
			return;
		}

		actionError = '';
		isExporting = true;
		const projectName = selectedProject?.name ?? projectId;
		try {
			if (format === 'csv') {
				exportTasksAsCsv({
					projectId,
					projectName,
					tasks: orderedTasks,
					users
				});
				return;
			}

			await exportTasksAsXlsx({
				projectId,
				projectName,
				tasks: orderedTasks,
				users
			});
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'ファイル出力に失敗しました。';
		} finally {
			isExporting = false;
		}
	}

	function resetFilters(): void {
		taskFilters = { ...DEFAULT_TASK_FILTERS };
	}

	function setListColumnWidths(nextWidths: ListColumnWidths): void {
		listColumnWidths = normalizeListColumnWidths(nextWidths);
		isListColumnAuto = false;
	}

	function autoFitListColumns(): void {
		isListColumnAuto = true;
		listColumnWidths = computeAutoColumnWidths(orderedTasks, users);
	}

	function selectTask(taskId: string): void {
		selectedTaskId = taskId;
	}

	async function reorderTasks(sourceTaskId: string, targetTaskId: string): Promise<void> {
		const projectId = selectedProjectId;
		if (!projectId) {
			actionError = 'プロジェクトを選択してください。';
			return;
		}

		const reorderedIds = reorderTaskIds(orderedTasks, sourceTaskId, targetTaskId);
		if (!reorderedIds) {
			return;
		}
		if (reorderedIds.length === 0) {
			return;
		}

		const isSuccess = await runTaskAction(() =>
			reorderTasksAction({
				store: tasksStore,
				projectId,
				ids: reorderedIds
			})
		);
		if (isSuccess) {
			selectedTaskId = sourceTaskId;
		}
	}

	function openCreateModal(): void {
		if (!selectedProjectId) {
			actionError = 'プロジェクトを選択してください。';
			return;
		}

		const today = toIsoDate(new Date());
		modalMode = 'create';
		taskForm = {
			...EMPTY_TASK_FORM,
			startDate: today,
			endDate: addDays(today, 2)
		};
		editingTaskId = null;
		formError = '';
		isModalOpen = true;
	}

	function openEditModal(task?: Task): void {
		const target = task ?? selectedTask;
		if (!target) {
			return;
		}
		modalMode = 'edit';
		taskForm = {
			title: target.title,
			note: target.note,
			startDate: target.startDate,
			endDate: target.endDate,
			progress: target.progress,
			assigneeIds: [...target.assigneeIds],
			predecessorTaskId: target.predecessorTaskId ?? ''
		};
		editingTaskId = target.id;
		formError = '';
		isModalOpen = true;
	}

	function closeModal(): void {
		isModalOpen = false;
		formError = '';
		isSubmitting = false;
		editingTaskId = null;
	}

	async function submitTask(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const projectId = selectedProjectId;
		if (!projectId) {
			formError = 'プロジェクトを選択してください。';
			return;
		}

		const progress = Number(taskForm.progress);
		const error = validateTaskForm({
			title: taskForm.title,
			note: taskForm.note,
			startDate: taskForm.startDate,
			endDate: taskForm.endDate,
			progress,
			assigneeIds: taskForm.assigneeIds,
			predecessorTaskId: taskForm.predecessorTaskId
		});
		if (error) {
			formError = error;
			return;
		}

		const createInput = toCreateTaskInput({
			title: taskForm.title,
			note: taskForm.note,
			startDate: taskForm.startDate,
			endDate: taskForm.endDate,
			progress,
			assigneeIds: taskForm.assigneeIds,
			predecessorTaskId: taskForm.predecessorTaskId
		});

		isSubmitting = true;
		formError = '';
		actionError = '';

		try {
			const result = await submitTaskAction({
				store: tasksStore,
				mode: modalMode,
				projectId,
				createInput,
				editingTaskId,
				sourceTask: editingTaskId ? (taskById.get(editingTaskId) ?? null) : null
			});

			if (result.kind === 'error') {
				formError = result.message;
				return;
			}

			selectedTaskId = result.selectedTaskId;
			closeModal();
		} finally {
			isSubmitting = false;
		}
	}

	async function deleteSelectedTask(): Promise<void> {
		const projectId = selectedProjectId;
		const target = selectedTask;
		if (!projectId || !target || typeof window === 'undefined') {
			return;
		}
		const confirmed = window.confirm(`"${target.title}" を削除します。よろしいですか？`);
		if (!confirmed) {
			return;
		}
		await runTaskAction(() =>
			deleteTaskAction({
				store: tasksStore,
				projectId,
				taskId: target.id
			})
		);
	}

	function toggleFormAssignee(userId: string): void {
		taskForm.assigneeIds = toggleAssignee(taskForm.assigneeIds, userId);
	}

	function getAssigneeNames(task: Task): string[] {
		return resolveAssigneeNames(task, users);
	}

	function getAssigneeSummary(task: Task): string {
		return resolveAssigneeSummary(task, users);
	}

	function hasDependencyViolation(task: Task): boolean {
		return hasTaskDependencyViolation(task, taskById);
	}

	function setTaskDatePreview(taskId: string, startDate: string, endDate: string): void {
		taskDatePreviews = {
			...taskDatePreviews,
			[taskId]: { startDate, endDate }
		};
	}

	function clearTaskDatePreview(taskId: string): void {
		if (!(taskId in taskDatePreviews)) {
			return;
		}
		const nextPreviews = { ...taskDatePreviews };
		delete nextPreviews[taskId];
		taskDatePreviews = nextPreviews;
	}

	function getDisplayStart(task: Task): string {
		return taskDatePreviews[task.id]?.startDate ?? task.startDate;
	}

	function getDisplayEnd(task: Task): string {
		return taskDatePreviews[task.id]?.endDate ?? task.endDate;
	}

	async function commitTaskDateRange(
		taskId: string,
		startDate: string,
		endDate: string
	): Promise<void> {
		const projectId = selectedProjectId;
		if (!projectId) {
			actionError = 'プロジェクトを選択してください。';
			return;
		}
		const sourceTask = taskById.get(taskId);
		if (!sourceTask) {
			return;
		}

		await runTaskAction(() =>
			commitTaskDateRangeAction({
				store: tasksStore,
				projectId,
				taskId,
				startDate: startDate,
				endDate: endDate,
				updatedAt: sourceTask.updatedAt
			})
		);
	}
</script>

<div class="h-screen overflow-hidden bg-slate-100 text-slate-800 select-none">
	<div class="flex h-full flex-col">
		<GanttToolbar
			{zoom}
			{projects}
			{selectedProjectId}
			hasSelectedTask={Boolean(selectedTask)}
			onProjectChange={(projectId) => void changeProject(projectId)}
			onCreate={openCreateModal}
			onEdit={() => openEditModal()}
			onDelete={deleteSelectedTask}
			onExport={(format) => void exportTasks(format)}
			exportDisabled={!canExportTasks}
			{isExporting}
			onZoomChange={setZoom}
		/>
		<TaskFiltersBar
			{users}
			query={taskFilters.query}
			assignee={taskFilters.assignee}
			status={taskFilters.status}
			rangeStart={taskFilters.rangeStart}
			rangeEnd={taskFilters.rangeEnd}
			total={orderedTasks.length}
			matched={visibleTasks.length}
			hasActive={hasActiveFilters}
			onQueryChange={(value) => (taskFilters.query = value)}
			onAssigneeChange={(value) => (taskFilters.assignee = value)}
			onStatusChange={(value) => (taskFilters.status = value)}
			onRangeStartChange={(value) => (taskFilters.rangeStart = value)}
			onRangeEndChange={(value) => (taskFilters.rangeEnd = value)}
			onReset={resetFilters}
		/>
		{#if actionError}
			<div class="border-y border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
				{actionError}
			</div>
		{/if}

		<main class="min-h-0 flex-1 overflow-auto">
			<div
				class="grid min-h-full min-w-0 grid-cols-1 lg:[grid-template-columns:var(--task-pane-width)_minmax(0,1fr)]"
				style={`--task-pane-width: ${taskListPaneWidth}px;`}
			>
				<TaskListPane
					tasks={visibleTasks}
					totalTasks={orderedTasks.length}
					isFiltered={hasActiveFilters}
					{selectedTaskId}
					{getDisplayStart}
					{getDisplayEnd}
					{getAssigneeNames}
					{hasDependencyViolation}
					columnWidths={listColumnWidths}
					isAutoWidth={isListColumnAuto}
					onSelect={selectTask}
					onEdit={openEditModal}
					onReorder={reorderTasks}
					onColumnWidthsChange={setListColumnWidths}
					onAutoFit={autoFitListColumns}
				/>
				<GanttTimelinePane
					tasks={visibleTasks}
					{selectedTaskId}
					{zoom}
					{getAssigneeSummary}
					{hasDependencyViolation}
					onSelect={selectTask}
					onEdit={openEditModal}
					onPreviewChange={setTaskDatePreview}
					onPreviewClear={clearTaskDatePreview}
					onCommitDates={commitTaskDateRange}
				/>
			</div>
		</main>
	</div>

	<TaskModal
		open={isModalOpen}
		mode={modalMode}
		title={taskForm.title}
		note={taskForm.note}
		startDate={taskForm.startDate}
		endDate={taskForm.endDate}
		progress={taskForm.progress}
		{users}
		tasks={orderedTasks}
		currentTaskId={editingTaskId}
		assigneeIds={taskForm.assigneeIds}
		predecessorTaskId={taskForm.predecessorTaskId}
		error={formError}
		{isSubmitting}
		onClose={closeModal}
		onSubmit={submitTask}
		onTitleChange={(value) => (taskForm.title = value)}
		onNoteChange={(value) => (taskForm.note = value)}
		onStartDateChange={(value) => (taskForm.startDate = value)}
		onEndDateChange={(value) => (taskForm.endDate = value)}
		onProgressChange={(value) => (taskForm.progress = value)}
		onToggleAssignee={toggleFormAssignee}
		onPredecessorChange={(value) => (taskForm.predecessorTaskId = value)}
	/>
</div>
