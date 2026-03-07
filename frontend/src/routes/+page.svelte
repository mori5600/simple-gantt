<script lang="ts">
	import { onMount } from 'svelte';
	import ActionFeedbackBanner from '$lib/components/gantt/ActionFeedbackBanner.svelte';
	import GanttTimelinePane from '$lib/components/gantt/GanttTimelinePane.svelte';
	import GanttToolbar from '$lib/components/gantt/GanttToolbar.svelte';
	import PendingImportAlert from '$lib/components/gantt/PendingImportAlert.svelte';
	import TaskFiltersBar from '$lib/components/gantt/TaskFiltersBar.svelte';
	import TaskListPane from '$lib/components/gantt/TaskListPane.svelte';
	import TaskModal from '$lib/components/gantt/TaskModal.svelte';
	import { type ModalMode } from '$lib/features/gantt/actions';
	import type { TaskImportRow } from '$lib/features/gantt/import';
	import type { TaskFilters } from '$lib/features/gantt/filterStorage';
	import { mountGanttPageLifecycle } from '$lib/features/gantt/lifecycle';
	import { LIST_COLUMN_DEFAULT_WIDTHS } from '$lib/features/gantt/listColumns';
	import { createGanttPageEffects } from '$lib/features/gantt/pageEffects';
	import {
		buildAssigneeNamesByTaskId,
		ensureSelectedTaskId,
		filterTasksByFilters,
		hasActiveTaskFilters,
		isTaskOverdue,
		indexTasksById,
		orderTasksForDisplay,
		type TaskFormInput
	} from '$lib/features/gantt/state';
	import { createGanttPageHandlers } from '$lib/features/gantt/pageHandlers';
	import { createGanttPageViewBindings } from '$lib/features/gantt/pageViewBindings';
	import { resolvePollIntervalMs } from '$lib/shared/polling';
	import type { ListColumnWidths, TaskDateRange, ZoomLevel } from '$lib/features/gantt/types';
	import type { UndoTaskUpdate } from '$lib/features/gantt/undo';
	import { tasksStore } from '$lib/stores/tasksStore';
	import { tasksRepo, type Project, type Task, type User } from '$lib/data/tasks/repo';

	const FILTERS_STORAGE_KEY = 'simple-gantt:task-filters:v1';
	const PROJECT_STORAGE_KEY = 'simple-gantt:selected-project:v1';
	const DEFAULT_GANTT_SYNC_POLL_INTERVAL_MS = resolvePollIntervalMs(
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
	let projectMembers = $state<User[]>([]);
	let selectedProjectId = $state('');
	let selectedTaskId = $state<string | null>(null);
	let zoom = $state<ZoomLevel>('day');
	let actionError = $state('');
	let actionSuccess = $state('');

	let isModalOpen = $state(false);
	let modalMode = $state<ModalMode>('create');
	let taskForm = $state<TaskFormInput>({ ...EMPTY_TASK_FORM });
	let editingTaskId = $state<string | null>(null);
	let formError = $state('');
	let isSubmitting = $state(false);
	let isUndoing = $state(false);
	let isImporting = $state(false);
	let isExporting = $state(false);
	let listColumnWidths = $state<ListColumnWidths>([...LIST_COLUMN_DEFAULT_WIDTHS]);
	let isListColumnAuto = $state(true);

	let taskFilters = $state<TaskFilters>({ ...DEFAULT_TASK_FILTERS });
	let isFilterStorageReady = $state(false);
	let isProjectStorageReady = $state(false);
	let isInitialLoadCompleted = $state(false);

	let taskDatePreviews = $state<Record<string, TaskDateRange>>({});
	let pendingImportRows = $state<TaskImportRow[] | null>(null);
	let pendingImportFileName = $state('');
	let pendingMissingAssigneeNames = $state<string[]>([]);
	let lastUndoAction = $state<UndoTaskUpdate | null>(null);
	let scrollToTodayRequest = $state(0);

	const orderedTasks = $derived.by(() => orderTasksForDisplay(tasks));
	const selectedProject = $derived.by(
		() => projects.find((project) => project.id === selectedProjectId) ?? null
	);
	const canExportTasks = $derived.by(
		() => selectedProjectId.length > 0 && orderedTasks.length > 0 && !isExporting
	);
	const hasActiveFilters = $derived.by(() => hasActiveTaskFilters(taskFilters));
	const visibleTasks = $derived.by(() => filterTasksByFilters(orderedTasks, taskFilters));
	const overdueCount = $derived.by(() => visibleTasks.filter((task) => isTaskOverdue(task)).length);

	const selectedTask = $derived.by(() => {
		if (!selectedTaskId) {
			return null;
		}
		return visibleTasks.find((task) => task.id === selectedTaskId) ?? null;
	});
	const taskById = $derived.by(() => indexTasksById(orderedTasks));
	const assigneeNamesByTaskId = $derived.by(() => buildAssigneeNamesByTaskId(orderedTasks, users));

	const taskListPaneWidth = $derived(listColumnWidths.reduce((total, width) => total + width, 0));

	onMount(() => {
		actionError = '';
		return mountGanttPageLifecycle({
			store: tasksStore,
			refreshProject: (projectId) => tasksStore.refresh(projectId),
			filtersStorageKey: FILTERS_STORAGE_KEY,
			projectStorageKey: PROJECT_STORAGE_KEY,
			defaultSyncPollIntervalMs: DEFAULT_GANTT_SYNC_POLL_INTERVAL_MS,
			getSyncState: () => ({
				selectedProjectId,
				isSubmitting,
				isInitialized: isInitialLoadCompleted
			}),
			onTaskFiltersRestored: (filters) => (taskFilters = { ...filters }),
			onStorageReady: () => {
				isFilterStorageReady = true;
				isProjectStorageReady = true;
			},
			onTasks: (nextTasks) => {
				tasks = nextTasks;
				selectedTaskId = ensureSelectedTaskId(nextTasks, selectedTaskId);
			},
			onProjects: (nextProjects) => (projects = nextProjects),
			onUsers: (nextUsers) => (users = nextUsers),
			onProjectMembers: (nextMembers) => (projectMembers = nextMembers),
			onSyncError: (message) => (actionError = message),
			onInitializeSuccess: (projectId) => {
				selectedProjectId = projectId;
				isInitialLoadCompleted = true;
			},
			onInitializeError: (message) => {
				selectedProjectId = '';
				selectedTaskId = null;
				actionError = message;
				isInitialLoadCompleted = true;
			}
		});
	});

	const pageEffects = createGanttPageEffects({
		state: {
			read: () => ({
				visibleTasks,
				selectedTaskId,
				isListColumnAuto,
				orderedTasks,
				projectMembers,
				taskFilters,
				hasActiveFilters,
				isFilterStorageReady,
				isProjectStorageReady,
				selectedProjectId,
				taskDatePreviews
			}),
			setSelectedTaskId: (taskId) => (selectedTaskId = taskId),
			setListColumnWidths: (widths) => (listColumnWidths = widths),
			setTaskFilters: (filters) => (taskFilters = filters),
			setTaskDatePreviews: (previews) => (taskDatePreviews = previews)
		},
		storage: {
			getStorage: () => (typeof localStorage === 'undefined' ? undefined : localStorage),
			filtersStorageKey: FILTERS_STORAGE_KEY,
			projectStorageKey: PROJECT_STORAGE_KEY
		}
	});

	$effect(pageEffects.syncSelectedTask);
	$effect(pageEffects.syncAutoListColumns);
	$effect(pageEffects.persistTaskFilters);
	$effect(pageEffects.persistSelectedProject);
	$effect(pageEffects.sanitizeAssigneeFilter);
	$effect(pageEffects.trimTaskDatePreviews);

	function clearPendingImport(): void {
		pendingImportRows = null;
		pendingImportFileName = '';
		pendingMissingAssigneeNames = [];
	}

	function closeModal(): void {
		isModalOpen = false;
		formError = '';
		isSubmitting = false;
		editingTaskId = null;
	}

	function jumpToToday(): void {
		scrollToTodayRequest += 1;
	}

	const {
		setZoom,
		resetFilters,
		setListColumnWidths,
		autoFitListColumns,
		selectTask,
		getAssigneeNames,
		getAssigneeSummary,
		hasDependencyViolation,
		getDisplayStart,
		getDisplayEnd
	} = createGanttPageViewBindings({
		state: {
			read: () => ({
				assigneeNamesByTaskId,
				orderedTasks,
				projectMembers,
				taskDatePreviews,
				taskById
			}),
			setIsListColumnAuto: (value) => (isListColumnAuto = value),
			setListColumnWidths: (widths) => (listColumnWidths = widths),
			setSelectedTaskId: (taskId) => (selectedTaskId = taskId),
			setTaskFilters: (filters) => (taskFilters = filters),
			setZoom: (nextZoom) => (zoom = nextZoom)
		},
		defaultTaskFilters: DEFAULT_TASK_FILTERS
	});

	const {
		changeProject,
		exportTasks,
		importTasks,
		cancelPendingImport,
		createMissingUsersAndContinue,
		reorderTasks,
		openCreateModal,
		openTaskEditPage,
		submitTask,
		deleteSelectedTask,
		commitTaskDateRange,
		undoLastChange,
		toggleFormAssignee,
		setTaskDatePreview,
		clearTaskDatePreview
	} = createGanttPageHandlers({
		state: {
			read: () => ({
				editingTaskId,
				lastUndoAction,
				modalMode,
				orderedTasks,
				pendingImportRows,
				pendingMissingAssigneeNames,
				projectMembers,
				selectedProjectId,
				selectedProjectName: selectedProject?.name ?? selectedProjectId,
				selectedTask,
				taskById,
				taskDatePreviews,
				taskForm,
				users
			}),
			clearPendingImport,
			closeModal,
			setActionError: (message) => (actionError = message),
			setActionSuccess: (message) => (actionSuccess = message),
			setEditingTaskId: (taskId) => (editingTaskId = taskId),
			setFormError: (message) => (formError = message),
			setIsExporting: (value) => (isExporting = value),
			setIsImporting: (value) => (isImporting = value),
			setIsModalOpen: (value) => (isModalOpen = value),
			setIsSubmitting: (value) => (isSubmitting = value),
			setIsUndoing: (value) => (isUndoing = value),
			setModalMode: (value) => (modalMode = value),
			setPendingImportState: (value) => {
				pendingImportRows = value.rows;
				pendingImportFileName = value.fileName;
				pendingMissingAssigneeNames = value.missingAssigneeNames;
			},
			setSelectedProjectId: (projectId) => (selectedProjectId = projectId),
			setSelectedTaskId: (taskId) => (selectedTaskId = taskId),
			setTaskDatePreviews: (previews) => (taskDatePreviews = previews),
			setTaskForm: (value) => (taskForm = value),
			setUndoAction: (value) => (lastUndoAction = value)
		},
		deps: {
			store: tasksStore,
			createUser: (input) => tasksRepo.createUser(input),
			setProjectMembers: (projectId, userIds) => tasksRepo.setProjectMembers(projectId, userIds),
			isBrowser: () => typeof window !== 'undefined',
			confirmDelete: (taskTitle) => window.confirm(`"${taskTitle}" を削除します。よろしいですか？`),
			emptyTaskForm: EMPTY_TASK_FORM
		}
	});
</script>

<div class="h-screen overflow-hidden bg-slate-100 text-slate-800 select-none">
	<div class="flex h-full flex-col">
		<GanttToolbar
			{zoom}
			{projects}
			{selectedProjectId}
			{isListColumnAuto}
			hasSelectedTask={Boolean(selectedTask)}
			hasUndoableChange={lastUndoAction !== null}
			onProjectChange={(projectId) => void changeProject(projectId)}
			onCreate={openCreateModal}
			onEdit={() => openTaskEditPage()}
			onDelete={deleteSelectedTask}
			onJumpToToday={jumpToToday}
			onAutoFit={autoFitListColumns}
			onUndo={() => void undoLastChange()}
			onImport={(file) => void importTasks(file)}
			importDisabled={selectedProjectId.length === 0 || pendingMissingAssigneeNames.length > 0}
			{isImporting}
			onExport={(format) => void exportTasks(format)}
			exportDisabled={!canExportTasks}
			{isExporting}
			{isUndoing}
			onZoomChange={setZoom}
		/>
		<TaskFiltersBar
			users={projectMembers}
			query={taskFilters.query}
			assignee={taskFilters.assignee}
			status={taskFilters.status}
			rangeStart={taskFilters.rangeStart}
			rangeEnd={taskFilters.rangeEnd}
			total={orderedTasks.length}
			matched={visibleTasks.length}
			{overdueCount}
			hasActive={hasActiveFilters}
			onQueryChange={(value) => (taskFilters.query = value)}
			onAssigneeChange={(value) => (taskFilters.assignee = value)}
			onStatusChange={(value) => (taskFilters.status = value)}
			onRangeStartChange={(value) => (taskFilters.rangeStart = value)}
			onRangeEndChange={(value) => (taskFilters.rangeEnd = value)}
			onReset={resetFilters}
		/>
		<ActionFeedbackBanner {actionError} {actionSuccess} />
		{#if pendingMissingAssigneeNames.length > 0}
			<PendingImportAlert
				fileName={pendingImportFileName}
				missingAssigneeNames={pendingMissingAssigneeNames}
				{isImporting}
				onContinue={() => void createMissingUsersAndContinue()}
				onCancel={cancelPendingImport}
			/>
		{/if}

		<main class="min-h-0 flex-1 overflow-auto">
			<div
				class="grid min-h-full min-w-0 grid-cols-1 lg:grid-cols-[var(--task-pane-width)_minmax(0,1fr)]"
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
					{isTaskOverdue}
					{hasDependencyViolation}
					columnWidths={listColumnWidths}
					onSelect={selectTask}
					onEdit={openTaskEditPage}
					onReorder={reorderTasks}
					onColumnWidthsChange={setListColumnWidths}
				/>
				<GanttTimelinePane
					tasks={visibleTasks}
					{selectedTaskId}
					{zoom}
					{scrollToTodayRequest}
					{getAssigneeSummary}
					{isTaskOverdue}
					{hasDependencyViolation}
					onSelect={selectTask}
					onEdit={openTaskEditPage}
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
		users={projectMembers}
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
