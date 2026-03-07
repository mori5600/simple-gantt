import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Task } from '$lib/data/tasks/repo';
import TaskListPane from './TaskListPane.svelte';

type ListColumnWidths = [number, number, number, number, number];

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

function renderTaskListPane(
	props: Partial<{
		tasks: Task[];
		totalTasks: number;
		isFiltered: boolean;
		selectedTaskId: string | null;
		columnWidths: ListColumnWidths;
		getAssigneeNames: (task: Task) => string[];
		isTaskOverdue: (task: Task) => boolean;
		hasDependencyViolation: (task: Task) => boolean;
		onSelect: (taskId: string) => void;
		onEdit: (task: Task) => void;
		onReorder: (sourceTaskId: string, targetTaskId: string) => void;
		onColumnWidthsChange: (nextWidths: ListColumnWidths) => void;
	}> = {}
) {
	return render(TaskListPane, {
		props: {
			tasks: [taskFixture()],
			totalTasks: 1,
			isFiltered: false,
			selectedTaskId: 'task-1',
			getDisplayStart: (task: Task) => task.startDate,
			getDisplayEnd: (task: Task) => task.endDate,
			getAssigneeNames: (task: Task) => task.assigneeIds,
			isTaskOverdue: () => false,
			hasDependencyViolation: () => false,
			columnWidths: [220, 170, 112, 112, 132] as ListColumnWidths,
			onSelect: vi.fn(),
			onEdit: vi.fn(),
			onReorder: vi.fn(),
			onColumnWidthsChange: vi.fn(),
			...props
		}
	});
}

describe('TaskListPane.svelte', () => {
	it('should render empty states for filtered and unfiltered lists', async () => {
		const { rerender } = renderTaskListPane({
			tasks: [],
			totalTasks: 0,
			isFiltered: false,
			selectedTaskId: null
		});

		await expect.element(page.getByText('タスクがありません。')).toBeInTheDocument();

		await rerender({
			tasks: [],
			totalTasks: 2,
			isFiltered: true,
			selectedTaskId: null
		});

		await expect.element(page.getByText('一致するタスクがありません。')).toBeInTheDocument();
	});

	it('should render overdue and dependency badges and handle selection/edit', async () => {
		const onSelect = vi.fn();
		const onEdit = vi.fn();
		const task = taskFixture({
			title: '実装',
			assigneeIds: ['佐藤', '山田']
		});
		const view = renderTaskListPane({
			tasks: [task],
			selectedTaskId: task.id,
			isTaskOverdue: () => true,
			hasDependencyViolation: () => true,
			onSelect,
			onEdit
		});

		await expect.element(page.getByText('遅延')).toBeInTheDocument();
		await expect.element(page.getByText('依存違反')).toBeInTheDocument();
		await expect.element(page.getByTitle('佐藤, 山田')).toBeInTheDocument();

		const row = view.container.querySelector('button[draggable="true"]');
		if (!(row instanceof HTMLButtonElement)) {
			throw new Error('expected task row button');
		}

		row.click();
		row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		expect(onSelect).toHaveBeenCalledWith(task.id);
		expect(onEdit).toHaveBeenCalledWith(task);
	});

	it('should support drag reorder between task rows', async () => {
		const onReorder = vi.fn();
		const sourceTask = taskFixture({ id: 'task-1', title: '要件確認' });
		const targetTask = taskFixture({ id: 'task-2', title: '実装' });
		const view = renderTaskListPane({
			tasks: [sourceTask, targetTask],
			selectedTaskId: sourceTask.id,
			onReorder
		});
		const rows = [...view.container.querySelectorAll('button[draggable="true"]')];
		const sourceRow = rows[0];
		const targetRow = rows[1];
		if (!(sourceRow instanceof HTMLButtonElement) || !(targetRow instanceof HTMLButtonElement)) {
			throw new Error('expected draggable task rows');
		}

		const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
		Object.defineProperty(dragStartEvent, 'dataTransfer', {
			value: {
				effectAllowed: '',
				setData: vi.fn()
			}
		});
		sourceRow.dispatchEvent(dragStartEvent);

		const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
		Object.defineProperty(dragOverEvent, 'dataTransfer', {
			value: {
				dropEffect: ''
			}
		});
		targetRow.dispatchEvent(dragOverEvent);
		await vi.waitFor(() => {
			expect(targetRow.className).toContain('bg-sky-100/70');
		});
		targetRow.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
		await vi.waitFor(() => {
			expect(targetRow.className).not.toContain('bg-sky-100/70');
		});
		targetRow.dispatchEvent(dragOverEvent);
		targetRow.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
		sourceRow.dispatchEvent(new DragEvent('dragend', { bubbles: true }));

		expect(onReorder).toHaveBeenCalledWith('task-1', 'task-2');
	});

	it('should resize columns through pointer drag and enforce minimum widths', async () => {
		const onColumnWidthsChange = vi.fn();
		renderTaskListPane({
			onColumnWidthsChange
		});

		const handle = page.getByRole('button', { name: 'Resize task column' }).element();
		handle.dispatchEvent(
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
				clientX: 40
			})
		);
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				pointerId: 1
			})
		);

		expect(onColumnWidthsChange).toHaveBeenCalledWith([160, 170, 112, 112, 132]);
	});

	it('should resize secondary columns through their dedicated handles', async () => {
		const onColumnWidthsChange = vi.fn();
		renderTaskListPane({
			onColumnWidthsChange
		});

		const cases = [
			{
				name: 'Resize assign column',
				pointerId: 2,
				clientX: 190,
				expected: [220, 260, 112, 112, 132]
			},
			{
				name: 'Resize start column',
				pointerId: 3,
				clientX: 160,
				expected: [220, 170, 172, 112, 132]
			},
			{
				name: 'Resize end column',
				pointerId: 4,
				clientX: 150,
				expected: [220, 170, 112, 162, 132]
			},
			{
				name: 'Resize progress column',
				pointerId: 5,
				clientX: 170,
				expected: [220, 170, 112, 112, 202]
			}
		] as const;

		for (const testCase of cases) {
			const handle = page.getByRole('button', { name: testCase.name }).element();
			handle.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					button: 0,
					pointerId: testCase.pointerId,
					clientX: 100
				})
			);
			window.dispatchEvent(
				new PointerEvent('pointermove', {
					pointerId: testCase.pointerId,
					clientX: testCase.clientX
				})
			);
			window.dispatchEvent(
				new PointerEvent('pointerup', {
					pointerId: testCase.pointerId
				})
			);
		}

		expect(onColumnWidthsChange).toHaveBeenNthCalledWith(1, [220, 260, 112, 112, 132]);
		expect(onColumnWidthsChange).toHaveBeenNthCalledWith(2, [220, 170, 172, 112, 132]);
		expect(onColumnWidthsChange).toHaveBeenNthCalledWith(3, [220, 170, 112, 162, 132]);
		expect(onColumnWidthsChange).toHaveBeenNthCalledWith(4, [220, 170, 112, 112, 202]);
	});
});
