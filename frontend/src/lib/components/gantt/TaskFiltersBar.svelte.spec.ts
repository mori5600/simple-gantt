import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { User } from '$lib/data/tasks/repo';
import TaskFiltersBar from './TaskFiltersBar.svelte';

const users: User[] = [
	{ id: 'user-1', name: '伊藤', updatedAt: '2026-03-01T00:00:00.000Z' },
	{ id: 'user-2', name: '佐藤', updatedAt: '2026-03-01T00:00:00.000Z' }
];

function renderFiltersBar(
	props: Partial<{
		query: string;
		assignee: string;
		status: 'all' | 'incomplete' | 'complete';
		rangeStart: string;
		rangeEnd: string;
		total: number;
		matched: number;
		overdueCount: number;
		hasActive: boolean;
		onQueryChange: (value: string) => void;
		onAssigneeChange: (value: string) => void;
		onStatusChange: (value: 'all' | 'incomplete' | 'complete') => void;
		onRangeStartChange: (value: string) => void;
		onRangeEndChange: (value: string) => void;
		onReset: () => void;
	}> = {}
) {
	return render(TaskFiltersBar, {
		props: {
			users,
			query: '要件',
			assignee: '',
			status: 'all',
			rangeStart: '',
			rangeEnd: '',
			total: 4,
			matched: 2,
			overdueCount: 1,
			hasActive: true,
			onQueryChange: vi.fn(),
			onAssigneeChange: vi.fn(),
			onStatusChange: vi.fn(),
			onRangeStartChange: vi.fn(),
			onRangeEndChange: vi.fn(),
			onReset: vi.fn(),
			...props
		}
	});
}

describe('TaskFiltersBar.svelte', () => {
	it('should render summary text and overdue badge', () => {
		const view = renderFiltersBar();

		expect(view.container.textContent).toContain('2 / 4 tasks');
		expect(view.container.textContent).toContain('遅延 1件');
	});

	it('should forward query, assignee, status, range, and reset changes', () => {
		const onQueryChange = vi.fn();
		const onAssigneeChange = vi.fn();
		const onStatusChange = vi.fn();
		const onRangeStartChange = vi.fn();
		const onRangeEndChange = vi.fn();
		const onReset = vi.fn();
		const view = renderFiltersBar({
			onQueryChange,
			onAssigneeChange,
			onStatusChange,
			onRangeStartChange,
			onRangeEndChange,
			onReset
		});

		const queryInput = view.container.querySelector('input[name="taskFilterQuery"]');
		const clearButton = view.container.querySelector('button[aria-label="検索条件をクリア"]');
		const assigneeSelect = view.container.querySelector('select[name="taskFilterAssignee"]');
		const statusSelect = view.container.querySelector('select[name="taskFilterStatus"]');
		const rangeStartInput = view.container.querySelector('input[name="taskFilterRangeStart"]');
		const rangeEndInput = view.container.querySelector('input[name="taskFilterRangeEnd"]');
		const resetButton = [...view.container.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'リセット'
		);

		if (
			!(queryInput instanceof HTMLInputElement) ||
			!(clearButton instanceof HTMLButtonElement) ||
			!(assigneeSelect instanceof HTMLSelectElement) ||
			!(statusSelect instanceof HTMLSelectElement) ||
			!(rangeStartInput instanceof HTMLInputElement) ||
			!(rangeEndInput instanceof HTMLInputElement) ||
			!(resetButton instanceof HTMLButtonElement)
		) {
			throw new Error('expected filter controls');
		}

		queryInput.value = '設計';
		queryInput.dispatchEvent(new Event('input', { bubbles: true }));
		clearButton.click();
		assigneeSelect.value = 'user-2';
		assigneeSelect.dispatchEvent(new Event('change', { bubbles: true }));
		statusSelect.value = 'complete';
		statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
		rangeStartInput.value = '2026-03-01';
		rangeStartInput.dispatchEvent(new Event('input', { bubbles: true }));
		rangeEndInput.value = '2026-03-31';
		rangeEndInput.dispatchEvent(new Event('input', { bubbles: true }));
		resetButton.click();

		expect(onQueryChange).toHaveBeenNthCalledWith(1, '設計');
		expect(onQueryChange).toHaveBeenNthCalledWith(2, '');
		expect(onAssigneeChange).toHaveBeenCalledWith('user-2');
		expect(onStatusChange).toHaveBeenCalledWith('complete');
		expect(onRangeStartChange).toHaveBeenCalledWith('2026-03-01');
		expect(onRangeEndChange).toHaveBeenCalledWith('2026-03-31');
		expect(onReset).toHaveBeenCalledOnce();
	});

	it('should disable reset and hide overdue badge when inactive', () => {
		const view = renderFiltersBar({
			query: '',
			total: 0,
			matched: 0,
			overdueCount: 0,
			hasActive: false
		});
		const resetButton = [...view.container.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'リセット'
		);

		if (!(resetButton instanceof HTMLButtonElement)) {
			throw new Error('expected reset button');
		}

		expect(view.container.textContent).toContain('0 tasks');
		expect(view.container.textContent).not.toContain('遅延');
		expect(resetButton.disabled).toBe(true);
	});
});
