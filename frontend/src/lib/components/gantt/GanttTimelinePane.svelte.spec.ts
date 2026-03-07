import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Task } from '$lib/data/tasks/repo';
import GanttTimelinePane from './GanttTimelinePane.svelte';

function taskFixture(partial: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		projectId: 'project-1',
		title: '要件確認',
		note: '',
		startDate: '2026-03-01',
		endDate: '2026-03-03',
		progress: 20,
		sortOrder: 0,
		updatedAt: '2026-03-01T00:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: null,
		...partial
	};
}

function renderTimeline(
	props: Partial<{
		tasks: Task[];
		selectedTaskId: string | null;
		zoom: 'day' | 'week' | 'month';
		scrollToTodayRequest: number;
		getAssigneeSummary: (task: Task) => string;
		isTaskOverdue: (task: Task) => boolean;
		hasDependencyViolation: (task: Task) => boolean;
		onSelect: (taskId: string) => void;
		onEdit: (task: Task) => void;
		onPreviewChange: (taskId: string, startDate: string, endDate: string) => void;
		onPreviewClear: (taskId: string) => void;
		onCommitDates: (taskId: string, startDate: string, endDate: string) => Promise<void>;
	}> = {}
) {
	return render(GanttTimelinePane, {
		props: {
			tasks: [taskFixture()],
			selectedTaskId: 'task-1',
			zoom: 'day',
			scrollToTodayRequest: 0,
			getAssigneeSummary: () => '伊藤',
			isTaskOverdue: () => false,
			hasDependencyViolation: () => false,
			onSelect: vi.fn(),
			onEdit: vi.fn(),
			onPreviewChange: vi.fn(),
			onPreviewClear: vi.fn(),
			onCommitDates: vi.fn(async () => {}),
			...props
		}
	});
}

describe('GanttTimelinePane.svelte', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('should render month headers, dependency links, and forward select/edit events', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-05T00:00:00.000Z'));

		const predecessor = taskFixture({
			id: 'task-1',
			title: '設計',
			startDate: '2026-03-01',
			endDate: '2026-03-04',
			sortOrder: 0
		});
		const task = taskFixture({
			id: 'task-2',
			title: '実装',
			startDate: '2026-03-03',
			endDate: '2026-03-06',
			sortOrder: 1,
			predecessorTaskId: 'task-1'
		});
		const onSelect = vi.fn();
		const onEdit = vi.fn();
		const view = renderTimeline({
			tasks: [predecessor, task],
			selectedTaskId: task.id,
			zoom: 'month',
			getAssigneeSummary: (entry) => (entry.id === task.id ? '佐藤, 山田' : '伊藤'),
			isTaskOverdue: (entry) => entry.id === task.id,
			hasDependencyViolation: (entry) => entry.id === task.id,
			onSelect,
			onEdit
		});

		expect(view.container.querySelector('[data-testid="month-header-band"]')).toBeTruthy();
		expect(view.container.querySelector('[title="2026-03"]')).toBeTruthy();

		const taskButton = view.container.querySelector(
			'button[title="実装 / 担当: 佐藤, 山田 / 遅延中 / 依存違反あり"]'
		);
		if (!(taskButton instanceof HTMLButtonElement)) {
			throw new Error('expected task button');
		}

		expect(view.container.querySelectorAll('svg path')).toHaveLength(1);
		expect(view.container.querySelectorAll('svg polygon')).toHaveLength(1);

		taskButton.click();
		taskButton.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		expect(onSelect).toHaveBeenCalledWith(task.id);
		expect(onEdit).toHaveBeenCalledWith(task);
	});

	it('should scroll the today line into view when the request token changes', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-05T00:00:00.000Z'));

		const task = taskFixture({
			startDate: '2026-03-01',
			endDate: '2026-03-08'
		});
		const view = renderTimeline({
			tasks: [task]
		});

		const todayLine = view.container.querySelector('[data-testid="gantt-today-line"]');
		if (!(todayLine instanceof HTMLDivElement)) {
			throw new Error('expected today line');
		}

		const scrollIntoViewSpy = vi.spyOn(todayLine, 'scrollIntoView');
		await view.rerender({
			tasks: [task],
			scrollToTodayRequest: 1
		});

		expect(scrollIntoViewSpy).toHaveBeenCalledWith({
			block: 'nearest',
			inline: 'center'
		});
		scrollIntoViewSpy.mockRestore();
	});

	it('should preview and commit moved dates when dragging a task bar', () => {
		const task = taskFixture();
		const onSelect = vi.fn();
		const onPreviewChange = vi.fn();
		const onPreviewClear = vi.fn();
		const onCommitDates = vi.fn(async () => {});
		const view = renderTimeline({
			tasks: [task],
			onSelect,
			onPreviewChange,
			onPreviewClear,
			onCommitDates
		});

		const taskButton = view.container.querySelector('button[title="要件確認 / 担当: 伊藤"]');
		if (!(taskButton instanceof HTMLButtonElement)) {
			throw new Error('expected draggable task button');
		}

		taskButton.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				button: 0,
				pointerId: 1,
				clientX: 100
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointermove', {
				pointerId: 1,
				clientX: 160
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				pointerId: 1
			})
		);

		expect(onSelect).toHaveBeenCalledWith(task.id);
		expect(onPreviewChange).toHaveBeenNthCalledWith(1, task.id, '2026-03-01', '2026-03-03');
		expect(onPreviewChange).toHaveBeenNthCalledWith(2, task.id, '2026-03-03', '2026-03-05');
		expect(onPreviewClear).toHaveBeenCalledWith(task.id);
		expect(onCommitDates).toHaveBeenCalledWith(task.id, '2026-03-03', '2026-03-05');
	});

	it('should pan the timeline scroll container from the background', () => {
		const task = taskFixture({
			startDate: '2026-01-01',
			endDate: '2026-03-31'
		});
		const view = renderTimeline({
			tasks: [task]
		});

		const scrollEl = view.container.querySelector('[data-testid="gantt-timeline-scroll"]');
		if (!(scrollEl instanceof HTMLDivElement)) {
			throw new Error('expected scroll container');
		}

		Object.defineProperty(scrollEl, 'scrollLeft', {
			value: 120,
			writable: true,
			configurable: true
		});
		scrollEl.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				button: 0,
				pointerId: 7,
				clientX: 200
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointermove', {
				pointerId: 7,
				clientX: 150
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				pointerId: 7
			})
		);

		expect(scrollEl.scrollLeft).toBe(170);
	});

	it('should render week zoom headers and clamp resize previews within the task range', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-05T00:00:00.000Z'));

		const onPreviewChange = vi.fn();
		const onCommitDates = vi.fn(async () => {});
		const view = renderTimeline({
			tasks: [
				taskFixture({
					startDate: '2026-03-03',
					endDate: '2026-03-05'
				})
			],
			zoom: 'week',
			onPreviewChange,
			onCommitDates
		});

		const headerCell = view.container.querySelector('[title="2026-03-02"]');
		if (!(headerCell instanceof HTMLDivElement)) {
			throw new Error('expected week header cell');
		}
		expect(headerCell.getAttribute('style')).toContain('width: 10px;');

		const taskButton = view.container.querySelector('button[title="要件確認 / 担当: 伊藤"]');
		const leftHandle = view.container.querySelector('span[role="presentation"][class*="left-0"]');
		const rightHandle = view.container.querySelector('span[role="presentation"][class*="right-0"]');
		if (
			!(taskButton instanceof HTMLButtonElement) ||
			!(leftHandle instanceof HTMLSpanElement) ||
			!(rightHandle instanceof HTMLSpanElement)
		) {
			throw new Error('expected task button and resize handles');
		}

		leftHandle.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				button: 0,
				pointerId: 11,
				clientX: 100
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointermove', {
				pointerId: 11,
				clientX: 180
			})
		);
		await vi.waitFor(() => {
			expect(taskButton.getAttribute('style')).toContain('width: 10px;');
		});
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				pointerId: 11
			})
		);

		rightHandle.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				button: 0,
				pointerId: 12,
				clientX: 100
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointermove', {
				pointerId: 12,
				clientX: 40
			})
		);
		await vi.waitFor(() => {
			expect(onPreviewChange).toHaveBeenCalledWith('task-1', '2026-03-05', '2026-03-05');
		});
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				pointerId: 12
			})
		);

		expect(onCommitDates).toHaveBeenNthCalledWith(1, 'task-1', '2026-03-05', '2026-03-05');
		expect(onCommitDates).toHaveBeenNthCalledWith(2, 'task-1', '2026-03-03', '2026-03-03');
	});
});
