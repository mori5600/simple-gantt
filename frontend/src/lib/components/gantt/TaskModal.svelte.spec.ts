import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Task, User } from '$lib/data/tasks/repo';
import TaskModal from './TaskModal.svelte';

const users: User[] = [
	{ id: 'user-1', name: '伊藤', updatedAt: '2026-03-01T00:00:00.000Z' },
	{ id: 'user-2', name: '佐藤', updatedAt: '2026-03-01T00:00:00.000Z' }
];

const tasks: Task[] = [
	{
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
		predecessorTaskId: null
	},
	{
		id: 'task-2',
		projectId: 'project-1',
		title: '実装',
		note: '',
		startDate: '2026-03-04',
		endDate: '2026-03-06',
		progress: 0,
		sortOrder: 1,
		updatedAt: '2026-03-01T00:00:00.000Z',
		assigneeIds: [],
		predecessorTaskId: null
	}
];

function renderModal(
	props: Partial<{
		open: boolean;
		mode: 'create' | 'edit';
		title: string;
		note: string;
		startDate: string;
		endDate: string;
		progress: number;
		currentTaskId: string | null;
		assigneeIds: string[];
		predecessorTaskId: string;
		error: string;
		isSubmitting: boolean;
		onClose: () => void;
		onSubmit: (event: SubmitEvent) => void;
		onTitleChange: (value: string) => void;
		onNoteChange: (value: string) => void;
		onStartDateChange: (value: string) => void;
		onEndDateChange: (value: string) => void;
		onProgressChange: (value: number) => void;
		onToggleAssignee: (userId: string) => void;
		onPredecessorChange: (taskId: string) => void;
	}> = {}
) {
	return render(TaskModal, {
		props: {
			open: true,
			mode: 'edit',
			title: '要件確認',
			note: 'メモ',
			startDate: '2026-03-01',
			endDate: '2026-03-03',
			progress: 20,
			users,
			tasks,
			currentTaskId: 'task-1',
			assigneeIds: ['user-1'],
			predecessorTaskId: '',
			error: '',
			isSubmitting: false,
			onClose: vi.fn(),
			onSubmit: vi.fn((event: SubmitEvent) => event.preventDefault()),
			onTitleChange: vi.fn(),
			onNoteChange: vi.fn(),
			onStartDateChange: vi.fn(),
			onEndDateChange: vi.fn(),
			onProgressChange: vi.fn(),
			onToggleAssignee: vi.fn(),
			onPredecessorChange: vi.fn(),
			...props
		}
	});
}

describe('TaskModal.svelte', () => {
	it('should not render when closed', () => {
		const view = renderModal({
			open: false
		});

		expect(view.container.querySelector('[role="dialog"]')).toBeNull();
	});

	it('should render derived assignee/predecessor state and error feedback', () => {
		const view = renderModal({
			error: '保存に失敗しました。'
		});

		expect(view.container.textContent).toContain('タスク編集');
		expect(view.container.textContent).toContain('伊藤');
		expect(view.container.textContent).toContain('保存に失敗しました。');

		const predecessorOptions = [
			...view.container.querySelectorAll('select[name="taskPredecessorTaskId"] option')
		].map((option) => option.textContent?.trim());
		expect(predecessorOptions).toContain('なし');
		expect(predecessorOptions).toContain('実装 (end: 2026-03-06, 0%)');
		expect(predecessorOptions).not.toContain('要件確認 (end: 2026-03-03, 20%)');
	});

	it('should forward field changes, checkbox toggles, submit, and close actions', () => {
		const onClose = vi.fn();
		const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
		const onTitleChange = vi.fn();
		const onNoteChange = vi.fn();
		const onStartDateChange = vi.fn();
		const onEndDateChange = vi.fn();
		const onProgressChange = vi.fn();
		const onToggleAssignee = vi.fn();
		const onPredecessorChange = vi.fn();
		const view = renderModal({
			onClose,
			onSubmit,
			onTitleChange,
			onNoteChange,
			onStartDateChange,
			onEndDateChange,
			onProgressChange,
			onToggleAssignee,
			onPredecessorChange,
			isSubmitting: true
		});

		const titleInput = view.container.querySelector('input[name="taskTitle"]');
		const noteInput = view.container.querySelector('textarea[name="taskNote"]');
		const startDateInput = view.container.querySelector('input[name="taskStartDate"]');
		const endDateInput = view.container.querySelector('input[name="taskEndDate"]');
		const progressInput = view.container.querySelector('input[name="taskProgress"]');
		const predecessorSelect = view.container.querySelector('select[name="taskPredecessorTaskId"]');
		const assigneeCheckbox = view.container.querySelector('input[type="checkbox"][value="user-2"]');
		const form = view.container.querySelector('form');
		const backdrop = view.container.querySelector('[role="presentation"]');
		const closeButton = view.container.querySelector('button[aria-label="close"]');
		const saveButton = [...view.container.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'Saving...'
		);

		if (
			!(titleInput instanceof HTMLInputElement) ||
			!(noteInput instanceof HTMLTextAreaElement) ||
			!(startDateInput instanceof HTMLInputElement) ||
			!(endDateInput instanceof HTMLInputElement) ||
			!(progressInput instanceof HTMLInputElement) ||
			!(predecessorSelect instanceof HTMLSelectElement) ||
			!(assigneeCheckbox instanceof HTMLInputElement) ||
			!(form instanceof HTMLFormElement) ||
			!(backdrop instanceof HTMLDivElement) ||
			!(closeButton instanceof HTMLButtonElement) ||
			!(saveButton instanceof HTMLButtonElement)
		) {
			throw new Error('expected modal controls');
		}

		titleInput.value = '更新タイトル';
		titleInput.dispatchEvent(new Event('input', { bubbles: true }));
		noteInput.value = '更新メモ';
		noteInput.dispatchEvent(new Event('input', { bubbles: true }));
		startDateInput.value = '2026-03-10';
		startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
		endDateInput.value = '2026-03-12';
		endDateInput.dispatchEvent(new Event('input', { bubbles: true }));
		progressInput.value = '55';
		progressInput.dispatchEvent(new Event('input', { bubbles: true }));
		predecessorSelect.value = 'task-2';
		predecessorSelect.dispatchEvent(new Event('change', { bubbles: true }));
		assigneeCheckbox.checked = true;
		assigneeCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
		form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		closeButton.click();

		expect(saveButton.disabled).toBe(true);
		expect(onTitleChange).toHaveBeenCalledWith('更新タイトル');
		expect(onNoteChange).toHaveBeenCalledWith('更新メモ');
		expect(onStartDateChange).toHaveBeenCalledWith('2026-03-10');
		expect(onEndDateChange).toHaveBeenCalledWith('2026-03-12');
		expect(onProgressChange).toHaveBeenCalledWith(55);
		expect(onPredecessorChange).toHaveBeenCalledWith('task-2');
		expect(onToggleAssignee).toHaveBeenCalledWith('user-2');
		expect(onSubmit).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledTimes(2);
	});
});
