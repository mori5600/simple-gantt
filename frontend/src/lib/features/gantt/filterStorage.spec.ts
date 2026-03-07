import { describe, expect, it } from 'vitest';
import { loadTaskFilters, saveTaskFilters, type TaskFilters } from './filterStorage';

class MemoryStorage implements Storage {
	private readonly store = new Map<string, string>();

	get length(): number {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.store.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}
}

describe('filterStorage', () => {
	it('loadTaskFilters should normalize stored values and fall back on malformed storage', () => {
		const storage = new MemoryStorage();
		expect(loadTaskFilters(storage, 'filters')).toEqual({
			query: '',
			assignee: '',
			status: 'all',
			rangeStart: '',
			rangeEnd: ''
		});

		storage.setItem(
			'filters',
			JSON.stringify({
				query: ' 要件 ',
				assignee: 'user-1',
				status: 'complete',
				rangeStart: 123,
				rangeEnd: 'broken'
			})
		);
		expect(loadTaskFilters(storage, 'filters')).toEqual({
			query: ' 要件 ',
			assignee: 'user-1',
			status: 'complete',
			rangeStart: '',
			rangeEnd: ''
		});

		storage.setItem('filters', '{broken');
		expect(loadTaskFilters(storage, 'filters')).toEqual({
			query: '',
			assignee: '',
			status: 'all',
			rangeStart: '',
			rangeEnd: ''
		});
	});

	it('loadTaskFilters should return defaults when storage throws', () => {
		const storage = {
			getItem() {
				throw new Error('boom');
			}
		} as unknown as Storage;

		expect(loadTaskFilters(storage, 'filters')).toEqual({
			query: '',
			assignee: '',
			status: 'all',
			rangeStart: '',
			rangeEnd: ''
		});
	});

	it('saveTaskFilters should persist active filters and remove inactive ones', () => {
		const storage = new MemoryStorage();
		const filters: TaskFilters = {
			query: '要件',
			assignee: 'user-1',
			status: 'incomplete',
			rangeStart: '2026-03-01',
			rangeEnd: '2026-03-31'
		};

		saveTaskFilters(storage, 'filters', filters, true);
		expect(storage.getItem('filters')).toBe(JSON.stringify(filters));

		saveTaskFilters(storage, 'filters', filters, false);
		expect(storage.getItem('filters')).toBeNull();
	});

	it('saveTaskFilters should ignore storage write failures', () => {
		const storage = {
			removeItem() {
				throw new Error('boom');
			},
			setItem() {
				throw new Error('boom');
			}
		} as unknown as Storage;

		expect(() =>
			saveTaskFilters(
				storage,
				'filters',
				{
					query: '',
					assignee: '',
					status: 'all',
					rangeStart: '',
					rangeEnd: ''
				},
				true
			)
		).not.toThrow();
		expect(() =>
			saveTaskFilters(
				storage,
				'filters',
				{
					query: '',
					assignee: '',
					status: 'all',
					rangeStart: '',
					rangeEnd: ''
				},
				false
			)
		).not.toThrow();
	});
});
