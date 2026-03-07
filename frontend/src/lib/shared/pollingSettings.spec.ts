import { describe, expect, it } from 'vitest';
import {
	clearPollingSettings,
	loadPollingSettings,
	POLLING_SETTINGS_STORAGE_KEY,
	resolvePollingIntervalForScope,
	savePollingSettings
} from './pollingSettings';

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

describe('pollingSettings', () => {
	it('loadPollingSettings should ignore missing, malformed, and invalid values', () => {
		const storage = new MemoryStorage();

		expect(loadPollingSettings(undefined)).toEqual({});
		expect(loadPollingSettings(storage)).toEqual({});

		storage.setItem(POLLING_SETTINGS_STORAGE_KEY, 'not-json');
		expect(loadPollingSettings(storage)).toEqual({});

		storage.setItem(
			POLLING_SETTINGS_STORAGE_KEY,
			JSON.stringify({
				ganttIntervalMs: 1234,
				adminIntervalMs: 'invalid'
			})
		);
		expect(loadPollingSettings(storage)).toEqual({});

		storage.setItem(POLLING_SETTINGS_STORAGE_KEY, JSON.stringify('broken'));
		expect(loadPollingSettings(storage)).toEqual({});
	});

	it('loadPollingSettings should accept allowed intervals and explicit null values', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			POLLING_SETTINGS_STORAGE_KEY,
			JSON.stringify({
				ganttIntervalMs: null,
				adminIntervalMs: 30_000
			})
		);

		expect(loadPollingSettings(storage)).toEqual({
			ganttIntervalMs: null,
			adminIntervalMs: 30_000
		});
	});

	it('savePollingSettings and clearPollingSettings should persist values', () => {
		const storage = new MemoryStorage();

		savePollingSettings(storage, {
			ganttIntervalMs: 15_000,
			adminIntervalMs: null
		});

		expect(storage.getItem(POLLING_SETTINGS_STORAGE_KEY)).toBe(
			JSON.stringify({
				ganttIntervalMs: 15_000,
				adminIntervalMs: null
			})
		);

		clearPollingSettings(storage);
		expect(storage.getItem(POLLING_SETTINGS_STORAGE_KEY)).toBeNull();

		expect(() =>
			savePollingSettings(undefined, {
				ganttIntervalMs: 15_000,
				adminIntervalMs: null
			})
		).not.toThrow();
		expect(() => clearPollingSettings(undefined)).not.toThrow();
	});

	it('resolvePollingIntervalForScope should honor null, explicit values, and defaults', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			POLLING_SETTINGS_STORAGE_KEY,
			JSON.stringify({
				ganttIntervalMs: null,
				adminIntervalMs: 20_000
			})
		);

		expect(
			resolvePollingIntervalForScope({
				scope: 'gantt',
				defaultIntervalMs: 15_000,
				storage
			})
		).toBeNull();
		expect(
			resolvePollingIntervalForScope({
				scope: 'admin',
				defaultIntervalMs: 15_000,
				storage
			})
		).toBe(20_000);
		expect(
			resolvePollingIntervalForScope({
				scope: 'admin',
				defaultIntervalMs: 15_000,
				storage: undefined
			})
		).toBe(15_000);
	});
});
