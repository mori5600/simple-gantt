<script lang="ts">
	import {
		addDays,
		diffDays,
		formatDay,
		fromIsoDate,
		isWeekend,
		toIsoDate
	} from '$lib/features/gantt/date';
	import type { ZoomLevel } from '$lib/features/gantt/types';
	import type { Task } from '$lib/tasksRepo';

	type DragMode = 'move' | 'resize-start' | 'resize-end';
	type TimelineCell = {
		date: string;
		weekend: boolean;
		dayLabel: string;
		weekLabel: string;
	};
	type MonthSegment = {
		key: string;
		label: string;
		width: number;
		showLabel: boolean;
	};
	type DragState = {
		pointerId: number;
		taskId: string;
		mode: DragMode;
		startX: number;
		originStart: string;
		originEnd: string;
		previewStart: string;
		previewEnd: string;
	};
	type DependencyLink = {
		id: string;
		path: string;
		arrowPoints: string;
		isViolation: boolean;
	};

	const TIMELINE_PADDING_DAYS = 3;
	const TASK_ROW_HEIGHT = 48;
	const TASK_BAR_CENTER_Y = 24;
	const LINK_BEND_OFFSET = 14;
	const MONTH_LABEL_MIN_WIDTH = 64;

	let {
		tasks,
		selectedTaskId,
		zoom,
		getAssigneeSummary,
		hasDependencyViolation,
		onSelect,
		onEdit,
		onPreviewChange,
		onPreviewClear,
		onCommitDates
	} = $props<{
		tasks: Task[];
		selectedTaskId: string | null;
		zoom: ZoomLevel;
		getAssigneeSummary: (task: Task) => string;
		hasDependencyViolation: (task: Task) => boolean;
		onSelect: (taskId: string) => void;
		onEdit: (task: Task) => void;
		onPreviewChange: (taskId: string, startDate: string, endDate: string) => void;
		onPreviewClear: (taskId: string) => void;
		onCommitDates: (taskId: string, startDate: string, endDate: string) => Promise<void>;
	}>();

	let timelineScrollEl = $state<HTMLDivElement | null>(null);
	let isPanning = $state(false);
	let panPointerId = $state<number | null>(null);
	let panStartX = 0;
	let panStartScrollLeft = 0;
	let dragState = $state<DragState | null>(null);

	const dayWidth = $derived.by(() => {
		if (zoom === 'day') {
			return 30;
		}
		if (zoom === 'week') {
			return 10;
		}
		return 6;
	});
	const timelineStart = $derived.by(() => {
		const today = toIsoDate(new Date());
		if (tasks.length === 0) {
			return addDays(today, -TIMELINE_PADDING_DAYS);
		}
		const minStart = tasks.reduce(
			(min: string, task: Task) => (task.startDate < min ? task.startDate : min),
			tasks[0].startDate
		);
		return addDays(minStart, -TIMELINE_PADDING_DAYS);
	});

	const timelineEnd = $derived.by(() => {
		const today = toIsoDate(new Date());
		if (tasks.length === 0) {
			return addDays(today, TIMELINE_PADDING_DAYS);
		}
		const maxEnd = tasks.reduce(
			(max: string, task: Task) => (task.endDate > max ? task.endDate : max),
			tasks[0].endDate
		);
		return addDays(maxEnd, TIMELINE_PADDING_DAYS);
	});

	const totalDays = $derived(Math.max(1, diffDays(timelineStart, timelineEnd) + 1));
	const timelineWidth = $derived(totalDays * dayWidth);
	const timelineCursor = $derived(isPanning ? 'cursor-grabbing' : 'cursor-grab');

	const timelineCells = $derived.by(() => {
		const cells: TimelineCell[] = [];
		for (let offset = 0; offset < totalDays; offset += 1) {
			const date = addDays(timelineStart, offset);
			const parsedDate = fromIsoDate(date);
			const isWeekStart = parsedDate.getUTCDay() === 1;

			cells.push({
				date,
				weekend: isWeekend(parsedDate),
				dayLabel: formatDay(parsedDate),
				weekLabel: isWeekStart ? formatDay(parsedDate) : ''
			});
		}
		return cells;
	});
	const monthSegments = $derived.by(() => {
		const segments: MonthSegment[] = [];
		if (timelineCells.length === 0) {
			return segments;
		}

		let startIndex = 0;
		let activeDate = fromIsoDate(timelineCells[0].date);
		let activeYear = activeDate.getUTCFullYear();
		let activeMonth = activeDate.getUTCMonth() + 1;

		for (let index = 1; index <= timelineCells.length; index += 1) {
			const isBoundary = index === timelineCells.length;
			if (!isBoundary) {
				const nextDate = fromIsoDate(timelineCells[index].date);
				const nextYear = nextDate.getUTCFullYear();
				const nextMonth = nextDate.getUTCMonth() + 1;
				if (nextYear === activeYear && nextMonth === activeMonth) {
					continue;
				}
			}

			const spanDays = index - startIndex;
			const monthText = String(activeMonth).padStart(2, '0');
			segments.push({
				key: `${activeYear}-${monthText}-${startIndex}`,
				label: `${activeYear}-${monthText}`,
				width: spanDays * dayWidth,
				showLabel: spanDays * dayWidth >= MONTH_LABEL_MIN_WIDTH
			});

			startIndex = index;
			if (!isBoundary) {
				activeDate = fromIsoDate(timelineCells[index].date);
				activeYear = activeDate.getUTCFullYear();
				activeMonth = activeDate.getUTCMonth() + 1;
			}
		}
		return segments;
	});

	const todayDate = $derived(toIsoDate(new Date()));
	const todayOffset = $derived(diffDays(timelineStart, todayDate) * dayWidth);
	const showTodayLine = $derived(todayOffset >= 0 && todayOffset <= timelineWidth);

	function getDisplayStart(task: Task): string {
		if (dragState && dragState.taskId === task.id) {
			return dragState.previewStart;
		}
		return task.startDate;
	}

	function getDisplayEnd(task: Task): string {
		if (dragState && dragState.taskId === task.id) {
			return dragState.previewEnd;
		}
		return task.endDate;
	}

	function getTaskLeft(task: Task): number {
		return diffDays(timelineStart, getDisplayStart(task)) * dayWidth;
	}

	function getTaskWidth(task: Task): number {
		const width = (diffDays(getDisplayStart(task), getDisplayEnd(task)) + 1) * dayWidth;
		return Math.max(10, width);
	}

	function getTaskRight(task: Task): number {
		return getTaskLeft(task) + getTaskWidth(task);
	}

	const dependencyLinks = $derived.by(() => {
		const links: DependencyLink[] = [];
		const taskById: Record<string, Task> = {};
		const taskIndexById: Record<string, number> = {};

		for (const [index, task] of tasks.entries()) {
			taskById[task.id] = task;
			taskIndexById[task.id] = index;
		}

		for (const [toIndex, task] of tasks.entries()) {
			if (!task.predecessorTaskId) {
				continue;
			}
			const predecessor = taskById[task.predecessorTaskId];
			if (!predecessor) {
				continue;
			}
			const fromIndex = taskIndexById[predecessor.id];
			if (fromIndex === undefined) {
				continue;
			}

			const fromX = getTaskRight(predecessor);
			const toX = getTaskLeft(task);
			const fromY = fromIndex * TASK_ROW_HEIGHT + TASK_BAR_CENTER_Y;
			const toY = toIndex * TASK_ROW_HEIGHT + TASK_BAR_CENTER_Y;
			const bendX = Math.max(fromX + LINK_BEND_OFFSET, toX - LINK_BEND_OFFSET);

			links.push({
				id: `${predecessor.id}->${task.id}`,
				path: `M ${fromX} ${fromY} L ${bendX} ${fromY} L ${bendX} ${toY} L ${toX} ${toY}`,
				arrowPoints: `${toX},${toY} ${toX - 6},${toY - 4} ${toX - 6},${toY + 4}`,
				isViolation: task.startDate < predecessor.endDate
			});
		}

		return links;
	});

	function getTaskBarClass(task: Task): string {
		const violation = hasDependencyViolation(task);
		if (task.id === selectedTaskId) {
			return violation
				? 'border-rose-500 bg-rose-100 text-rose-900 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]'
				: 'border-amber-500 bg-sky-100 text-slate-900 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]';
		}
		return violation
			? 'border-rose-400 bg-rose-50 text-rose-900'
			: 'border-sky-400 bg-sky-50 text-slate-800';
	}

	function startTimelinePan(event: PointerEvent): void {
		if (event.button !== 0 || !timelineScrollEl || dragState) {
			return;
		}
		const target = event.target as HTMLElement | null;
		if (target?.closest('[data-no-pan="true"]')) {
			return;
		}
		event.preventDefault();
		isPanning = true;
		panPointerId = event.pointerId;
		panStartX = event.clientX;
		panStartScrollLeft = timelineScrollEl.scrollLeft;
	}

	function beginTaskDrag(event: PointerEvent, task: Task, mode: DragMode): void {
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		onSelect(task.id);
		dragState = {
			pointerId: event.pointerId,
			taskId: task.id,
			mode,
			startX: event.clientX,
			originStart: task.startDate,
			originEnd: task.endDate,
			previewStart: task.startDate,
			previewEnd: task.endDate
		};
		onPreviewChange(task.id, task.startDate, task.endDate);
	}

	function handleGlobalPointerMove(event: PointerEvent): void {
		if (dragState && event.pointerId === dragState.pointerId) {
			const offsetDays = Math.round((event.clientX - dragState.startX) / dayWidth);
			let nextStart = dragState.originStart;
			let nextEnd = dragState.originEnd;

			if (dragState.mode === 'move') {
				nextStart = addDays(dragState.originStart, offsetDays);
				nextEnd = addDays(dragState.originEnd, offsetDays);
			}
			if (dragState.mode === 'resize-start') {
				const candidate = addDays(dragState.originStart, offsetDays);
				nextStart = candidate > dragState.originEnd ? dragState.originEnd : candidate;
			}
			if (dragState.mode === 'resize-end') {
				const candidate = addDays(dragState.originEnd, offsetDays);
				nextEnd = candidate < dragState.originStart ? dragState.originStart : candidate;
			}

			if (nextStart === dragState.previewStart && nextEnd === dragState.previewEnd) {
				return;
			}

			const taskId = dragState.taskId;
			dragState = {
				...dragState,
				previewStart: nextStart,
				previewEnd: nextEnd
			};
			onPreviewChange(taskId, nextStart, nextEnd);
			return;
		}

		if (isPanning && panPointerId === event.pointerId && timelineScrollEl) {
			const deltaX = event.clientX - panStartX;
			timelineScrollEl.scrollLeft = panStartScrollLeft - deltaX;
		}
	}

	function handleGlobalPointerUp(event: PointerEvent): void {
		if (dragState && event.pointerId === dragState.pointerId) {
			const state = dragState;
			dragState = null;
			onPreviewClear(state.taskId);
			if (state.previewStart !== state.originStart || state.previewEnd !== state.originEnd) {
				void onCommitDates(state.taskId, state.previewStart, state.previewEnd);
			}
		}
		if (isPanning && panPointerId === event.pointerId) {
			isPanning = false;
			panPointerId = null;
		}
	}
</script>

<svelte:window
	onpointermove={handleGlobalPointerMove}
	onpointerup={handleGlobalPointerUp}
	onpointercancel={handleGlobalPointerUp}
/>

<section class="min-w-0 border-t border-slate-300 bg-white lg:border-t-0">
	<div
		bind:this={timelineScrollEl}
		class={`h-full overflow-x-auto overflow-y-hidden ${timelineCursor}`}
		role="presentation"
		onpointerdown={startTimelinePan}
	>
		<div class="relative min-w-full" style={`width: ${timelineWidth}px;`}>
			<div class="sticky top-0 z-20 border-b border-slate-300 bg-slate-100">
				{#if zoom === 'month'}
					<div
						class="flex h-5 border-b border-slate-300/90 bg-slate-200/70"
						data-testid="month-header-band"
					>
						{#each monthSegments as segment (segment.key)}
							<div
								class="flex shrink-0 items-center justify-center overflow-hidden border-r border-slate-300 px-1 text-[11px] font-semibold text-slate-700"
								style={`width: ${segment.width}px;`}
								title={segment.label}
							>
								{#if segment.showLabel}
									<span class="truncate">{segment.label}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
				<div class={`flex ${zoom === 'month' ? 'h-5' : 'h-10'}`}>
					{#each timelineCells as cell (cell.date)}
						<div
							class={`flex shrink-0 items-end justify-center border-r border-slate-300 pb-1 text-[11px] font-medium ${
								cell.weekend ? 'bg-slate-200/60 text-slate-500' : 'text-slate-600'
							}`}
							style={`width: ${dayWidth}px;`}
							title={cell.date}
						>
							<span>{zoom === 'day' ? cell.dayLabel : cell.weekLabel}</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="relative">
				{#each tasks as task (task.id)}
					<div
						class={`relative h-12 border-b border-slate-200 ${
							task.id === selectedTaskId ? 'bg-sky-50/70' : 'bg-white'
						}`}
					>
						<div class="pointer-events-none absolute inset-0 flex">
							{#each timelineCells as cell (cell.date)}
								<div
									class={`h-full shrink-0 border-r border-slate-200 ${
										cell.weekend ? 'bg-slate-100/70' : ''
									}`}
									style={`width: ${dayWidth}px;`}
								></div>
							{/each}
						</div>

						<button
							type="button"
							class={`absolute top-2 z-10 h-8 overflow-hidden rounded-md border text-left ${getTaskBarClass(task)}`}
							data-no-pan="true"
							style={`left: ${getTaskLeft(task)}px; width: ${getTaskWidth(task)}px;`}
							title={`${task.title} / 担当: ${getAssigneeSummary(task)}${
								hasDependencyViolation(task) ? ' / 依存違反あり' : ''
							}`}
							onclick={() => onSelect(task.id)}
							ondblclick={() => onEdit(task)}
							onpointerdown={(event) => beginTaskDrag(event, task, 'move')}
						>
							<span
								class="absolute inset-y-0 left-0 bg-sky-500/35"
								style={`width: ${task.progress}%;`}
							></span>
							<span
								class="absolute inset-y-0 left-0 w-2 cursor-col-resize border-r border-slate-400/30 bg-white/40"
								role="presentation"
								data-no-pan="true"
								onpointerdown={(event) => beginTaskDrag(event, task, 'resize-start')}
							></span>
							<span
								class="absolute inset-y-0 right-0 w-2 cursor-col-resize border-l border-slate-400/30 bg-white/40"
								role="presentation"
								data-no-pan="true"
								onpointerdown={(event) => beginTaskDrag(event, task, 'resize-end')}
							></span>
							<span class="relative block truncate px-3 text-xs font-semibold">{task.title}</span>
						</button>
					</div>
				{/each}

				{#if dependencyLinks.length > 0}
					<svg
						class="pointer-events-none absolute inset-0 z-[5]"
						width={timelineWidth}
						height={tasks.length * TASK_ROW_HEIGHT}
						aria-hidden="true"
					>
						{#each dependencyLinks as link (link.id)}
							<path
								d={link.path}
								fill="none"
								stroke={link.isViolation ? 'rgb(225 29 72 / 0.8)' : 'rgb(71 85 105 / 0.75)'}
								stroke-width="1.5"
								stroke-linejoin="round"
								stroke-linecap="round"
							/>
							<polygon
								points={link.arrowPoints}
								fill={link.isViolation ? 'rgb(225 29 72 / 0.8)' : 'rgb(71 85 105 / 0.75)'}
							/>
						{/each}
					</svg>
				{/if}

				{#if showTodayLine}
					<div
						class="pointer-events-none absolute inset-y-0 w-0.5 bg-orange-500"
						style={`left: ${todayOffset}px;`}
					></div>
				{/if}
			</div>
		</div>
	</div>
</section>
