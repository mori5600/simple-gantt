import type { TaskCompletionFilter } from './types';

export const UNASSIGNED_ASSIGNEE = '__unassigned__';

export type TaskFilters = {
	query: string;
	assignee: string;
	status: TaskCompletionFilter;
	rangeStart: string;
	rangeEnd: string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DEFAULT_FILTERS: TaskFilters = {
	query: '',
	assignee: '',
	status: 'all',
	rangeStart: '',
	rangeEnd: ''
};

function normalizeStoredDate(value: unknown): string {
	if (typeof value !== 'string') {
		return '';
	}
	const trimmed = value.trim();
	return ISO_DATE_PATTERN.test(trimmed) ? trimmed : '';
}

function normalizeStoredStatus(value: unknown): TaskCompletionFilter {
	if (value === 'incomplete' || value === 'complete') {
		return value;
	}
	return 'all';
}

export function loadTaskFilters(storage: Storage, storageKey: string): TaskFilters {
	try {
		const raw = storage.getItem(storageKey);
		if (!raw) {
			return { ...DEFAULT_FILTERS };
		}
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		return {
			query: typeof parsed.query === 'string' ? parsed.query : '',
			assignee: typeof parsed.assignee === 'string' ? parsed.assignee : '',
			status: normalizeStoredStatus(parsed.status),
			rangeStart: normalizeStoredDate(parsed.rangeStart),
			rangeEnd: normalizeStoredDate(parsed.rangeEnd)
		};
	} catch {
		return { ...DEFAULT_FILTERS };
	}
}

export function saveTaskFilters(
	storage: Storage,
	storageKey: string,
	filters: TaskFilters,
	hasActiveFilters: boolean
): void {
	try {
		if (!hasActiveFilters) {
			storage.removeItem(storageKey);
			return;
		}
		storage.setItem(storageKey, JSON.stringify(filters));
	} catch {
		// ignore persistence failures
	}
}
