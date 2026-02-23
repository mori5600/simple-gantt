<script lang="ts">
	import type { Task } from '$lib/tasksRepo';

	type ListColumnWidths = [number, number, number, number, number];
	type ResizeState = {
		pointerId: number;
		columnIndex: number;
		startX: number;
		startWidth: number;
	};

	const COLUMN_MIN_WIDTHS: ListColumnWidths = [140, 120, 96, 96, 120];

	let {
		tasks,
		totalTasks = 0,
		isFiltered = false,
		selectedTaskId,
		getDisplayStart,
		getDisplayEnd,
		getAssigneeNames,
		hasDependencyViolation,
		columnWidths,
		isAutoWidth,
		onSelect,
		onEdit,
		onReorder,
		onColumnWidthsChange,
		onAutoFit
	} = $props<{
		tasks: Task[];
		totalTasks?: number;
		isFiltered?: boolean;
		selectedTaskId: string | null;
		getDisplayStart: (task: Task) => string;
		getDisplayEnd: (task: Task) => string;
		getAssigneeNames: (task: Task) => string[];
		hasDependencyViolation: (task: Task) => boolean;
		columnWidths: ListColumnWidths;
		isAutoWidth: boolean;
		onSelect: (taskId: string) => void;
		onEdit: (task: Task) => void;
		onReorder: (sourceTaskId: string, targetTaskId: string) => void | Promise<void>;
		onColumnWidthsChange: (nextWidths: ListColumnWidths) => void;
		onAutoFit: () => void;
	}>();

	let resizeState = $state<ResizeState | null>(null);
	let dragTaskId = $state<string | null>(null);
	let dragOverTaskId = $state<string | null>(null);

	const gridTemplate = $derived(
		`${columnWidths[0]}px ${columnWidths[1]}px ${columnWidths[2]}px ${columnWidths[3]}px ${columnWidths[4]}px`
	);

	function clamp(value: number, min: number): number {
		return Math.max(min, Math.round(value));
	}

	function getAssigneeText(names: readonly string[]): string {
		if (names.length === 0) {
			return '未割り当て';
		}
		if (names.length <= 2) {
			return names.join(', ');
		}
		return `${names[0]}, ${names[1]} +${names.length - 2}`;
	}

	function startResize(event: PointerEvent, columnIndex: number): void {
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		resizeState = {
			pointerId: event.pointerId,
			columnIndex,
			startX: event.clientX,
			startWidth: columnWidths[columnIndex]
		};
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!resizeState || event.pointerId !== resizeState.pointerId) {
			return;
		}
		const delta = event.clientX - resizeState.startX;
		const next = [...columnWidths] as ListColumnWidths;
		next[resizeState.columnIndex] = clamp(
			resizeState.startWidth + delta,
			COLUMN_MIN_WIDTHS[resizeState.columnIndex]
		);
		onColumnWidthsChange(next);
	}

	function handlePointerUp(event: PointerEvent): void {
		if (!resizeState || event.pointerId !== resizeState.pointerId) {
			return;
		}
		resizeState = null;
	}

	function startTaskDrag(event: DragEvent, taskId: string): void {
		dragTaskId = taskId;
		dragOverTaskId = null;
		if (!event.dataTransfer) {
			return;
		}
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', taskId);
	}

	function handleTaskDragOver(event: DragEvent, taskId: string): void {
		if (!dragTaskId || dragTaskId === taskId) {
			return;
		}
		event.preventDefault();
		dragOverTaskId = taskId;
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleTaskDrop(event: DragEvent, taskId: string): void {
		event.preventDefault();
		const sourceTaskId = dragTaskId;
		dragTaskId = null;
		dragOverTaskId = null;
		if (!sourceTaskId || sourceTaskId === taskId) {
			return;
		}
		onReorder(sourceTaskId, taskId);
	}

	function endTaskDrag(): void {
		dragTaskId = null;
		dragOverTaskId = null;
	}
</script>

<svelte:window
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerUp}
/>

<section class="min-w-0 border-t border-r border-slate-300 bg-white lg:border-t-0">
	<div class="sticky top-0 z-20 border-b border-slate-300 bg-slate-100">
		<div
			class="relative grid h-10 min-w-0 text-[11px] font-semibold tracking-wide text-slate-700"
			style={`grid-template-columns: ${gridTemplate};`}
		>
			<div class="relative flex min-w-0 items-center border-r border-slate-300 px-3 uppercase">
				<span class="truncate">Task</span>
				<button
					type="button"
					class="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-transparent"
					aria-label="Resize task column"
					onpointerdown={(event) => startResize(event, 0)}
				></button>
			</div>
			<div class="relative flex min-w-0 items-center border-r border-slate-300 px-3 uppercase">
				<span class="truncate">Assignee</span>
				<button
					type="button"
					class="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-transparent"
					aria-label="Resize assign column"
					onpointerdown={(event) => startResize(event, 1)}
				></button>
			</div>
			<div class="relative flex min-w-0 items-center border-r border-slate-300 px-3 uppercase">
				<span class="truncate">Start</span>
				<button
					type="button"
					class="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-transparent"
					aria-label="Resize start column"
					onpointerdown={(event) => startResize(event, 2)}
				></button>
			</div>
			<div class="relative flex min-w-0 items-center border-r border-slate-300 px-3 uppercase">
				<span class="truncate">End</span>
				<button
					type="button"
					class="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-transparent"
					aria-label="Resize end column"
					onpointerdown={(event) => startResize(event, 3)}
				></button>
			</div>
			<div class="relative flex min-w-0 items-center pr-14 pl-3 uppercase">
				<span class="truncate">Progress</span>
				<button
					type="button"
					class="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-transparent"
					aria-label="Resize progress column"
					onpointerdown={(event) => startResize(event, 4)}
				></button>
			</div>
			<button
				type="button"
				class={`absolute top-1/2 right-2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] leading-none ${
					isAutoWidth
						? 'border-sky-300 bg-sky-50 text-sky-700'
						: 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
				}`}
				onclick={onAutoFit}
				title="列幅を自動調整"
			>
				Auto
			</button>
		</div>
	</div>

	{#if tasks.length === 0}
		<div class="px-3 py-4 text-sm text-slate-500">
			{#if isFiltered && totalTasks > 0}
				一致するタスクがありません。
			{:else}
				タスクがありません。
			{/if}
		</div>
	{:else}
		{#each tasks as task (task.id)}
			{@const isDependencyViolation = hasDependencyViolation(task)}
			{@const assigneeNames = getAssigneeNames(task)}
			<button
				type="button"
				class={`grid h-12 w-full min-w-0 border-b border-slate-200 text-left text-sm text-slate-800 ${
					task.id === selectedTaskId ? 'bg-sky-50/70' : 'bg-white hover:bg-slate-50'
				} ${dragTaskId === task.id ? 'cursor-grabbing' : 'cursor-grab'} ${
					dragOverTaskId === task.id ? 'bg-sky-100/70 ring-1 ring-sky-300' : ''
				}`}
				draggable={true}
				style={`grid-template-columns: ${gridTemplate};`}
				onclick={() => onSelect(task.id)}
				ondblclick={() => onEdit(task)}
				ondragstart={(event) => startTaskDrag(event, task.id)}
				ondragover={(event) => handleTaskDragOver(event, task.id)}
				ondragleave={() => {
					if (dragOverTaskId === task.id) {
						dragOverTaskId = null;
					}
				}}
				ondrop={(event) => handleTaskDrop(event, task.id)}
				ondragend={endTaskDrag}
			>
				<div class="flex min-w-0 items-center gap-2 border-r border-slate-200 px-3">
					<span class="truncate font-semibold text-slate-900" title={task.title}>{task.title}</span>
					{#if isDependencyViolation}
						<span
							class="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700"
						>
							依存違反
						</span>
					{/if}
				</div>
				<span
					class={`truncate border-r border-slate-200 px-3 text-xs ${
						task.assigneeIds.length === 0 ? 'text-slate-600' : 'text-slate-700'
					}`}
					title={assigneeNames.join(', ') || '未割り当て'}
				>
					{getAssigneeText(assigneeNames)}
				</span>
				<span class="truncate border-r border-slate-200 px-3 font-mono text-slate-700">
					{getDisplayStart(task)}
				</span>
				<span class="truncate border-r border-slate-200 px-3 font-mono text-slate-700">
					{getDisplayEnd(task)}
				</span>
				<span class="truncate px-3 text-slate-700">{task.progress}%</span>
			</button>
		{/each}
	{/if}
</section>
