import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task, User } from '$lib/data/tasks/repo';
import type { TaskFormInput } from './state';
import type { TaskDateRange } from './types';
import { createGanttPageHandlers } from './pageHandlers';

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

function createStateHarness() {
	let selectedTask: Task | null = taskFixture({
		id: 'task selected',
		projectId: 'project selected'
	});
	let taskForm: TaskFormInput = {
		title: '',
		note: '',
		startDate: '',
		endDate: '',
		progress: 0,
		assigneeIds: [],
		predecessorTaskId: ''
	};
	let taskDatePreviews: Record<string, TaskDateRange> = {};

	const store = {
		create: vi.fn(),
		load: vi.fn(),
		remove: vi.fn(),
		reorder: vi.fn(),
		update: vi.fn()
	};

	const handlers = createGanttPageHandlers({
		state: {
			read: () => ({
				editingTaskId: null,
				modalMode: 'create',
				orderedTasks: [],
				pendingImportRows: null,
				pendingMissingAssigneeNames: [],
				projectMembers: [] as User[],
				selectedProjectId: 'project-1',
				selectedProjectName: 'project-1',
				selectedTask,
				taskById: new Map<string, Task>(),
				taskDatePreviews,
				taskForm,
				users: [] as User[]
			}),
			clearPendingImport: vi.fn(),
			closeModal: vi.fn(),
			setActionError: vi.fn(),
			setActionSuccess: vi.fn(),
			setEditingTaskId: vi.fn(),
			setFormError: vi.fn(),
			setIsExporting: vi.fn(),
			setIsImporting: vi.fn(),
			setIsModalOpen: vi.fn(),
			setIsSubmitting: vi.fn(),
			setModalMode: vi.fn(),
			setPendingImportState: vi.fn(),
			setSelectedProjectId: vi.fn(),
			setSelectedTaskId: vi.fn(),
			setTaskDatePreviews: (previews) => {
				taskDatePreviews = previews;
			},
			setTaskForm: (form) => {
				taskForm = form;
			}
		},
		deps: {
			store,
			createUser: vi.fn(),
			setProjectMembers: vi.fn(),
			isBrowser: () => true,
			confirmDelete: vi.fn().mockReturnValue(true),
			emptyTaskForm: {
				title: '',
				note: '',
				startDate: '',
				endDate: '',
				progress: 0,
				assigneeIds: [],
				predecessorTaskId: ''
			}
		}
	});

	return {
		handlers,
		setSelectedTask: (task: Task | null) => {
			selectedTask = task;
		},
		getTaskForm: () => taskForm,
		getTaskDatePreviews: () => taskDatePreviews
	};
}

describe('pageHandlers local handlers', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('openTaskEditPage should navigate to selected task edit page on browser', () => {
		const harness = createStateHarness();
		vi.stubGlobal('window', {
			location: {
				href: ''
			}
		});

		harness.handlers.openTaskEditPage();

		const href = (window as { location: { href: string } }).location.href;
		expect(href).toContain('/tasks/task%20selected');
		expect(href).toContain('projectId=project%20selected');
	});

	it('openTaskEditPage should prioritize explicit task argument', () => {
		const harness = createStateHarness();
		vi.stubGlobal('window', {
			location: {
				href: ''
			}
		});
		const explicitTask = taskFixture({
			id: 'task explicit',
			projectId: 'project explicit'
		});

		harness.handlers.openTaskEditPage(explicitTask);

		const href = (window as { location: { href: string } }).location.href;
		expect(href).toContain('/tasks/task%20explicit');
		expect(href).toContain('projectId=project%20explicit');
	});

	it('toggleFormAssignee should add and remove assignee id', () => {
		const harness = createStateHarness();

		harness.handlers.toggleFormAssignee('user-1');
		expect(harness.getTaskForm().assigneeIds).toEqual(['user-1']);

		harness.handlers.toggleFormAssignee('user-1');
		expect(harness.getTaskForm().assigneeIds).toEqual([]);
	});

	it('setTaskDatePreview and clearTaskDatePreview should mutate preview map', () => {
		const harness = createStateHarness();

		harness.handlers.setTaskDatePreview('task-1', '2026-03-10', '2026-03-12');
		expect(harness.getTaskDatePreviews()).toEqual({
			'task-1': {
				startDate: '2026-03-10',
				endDate: '2026-03-12'
			}
		});

		harness.handlers.clearTaskDatePreview('task-1');
		expect(harness.getTaskDatePreviews()).toEqual({});
	});

	it('openTaskEditPage should no-op when selected task is missing', () => {
		const harness = createStateHarness();
		vi.stubGlobal('window', {
			location: {
				href: 'unchanged'
			}
		});
		harness.setSelectedTask(null);

		harness.handlers.openTaskEditPage();

		const href = (window as { location: { href: string } }).location.href;
		expect(href).toBe('unchanged');
	});
});
