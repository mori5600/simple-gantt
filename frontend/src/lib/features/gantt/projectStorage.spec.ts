import { describe, expect, it } from 'vitest';
import { loadSelectedProjectId, saveSelectedProjectId } from './projectStorage';

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

describe('projectStorage', () => {
	it('loadSelectedProjectId should trim stored values and fall back on errors', () => {
		const storage = new MemoryStorage();
		storage.setItem('project', '  project-1  ');
		expect(loadSelectedProjectId(storage, 'project')).toBe('project-1');

		const brokenStorage = {
			getItem() {
				throw new Error('boom');
			}
		} as unknown as Storage;
		expect(loadSelectedProjectId(brokenStorage, 'project')).toBe('');
	});

	it('saveSelectedProjectId should persist trimmed ids, remove empty values, and ignore errors', () => {
		const storage = new MemoryStorage();

		saveSelectedProjectId(storage, 'project', '  project-2  ');
		expect(storage.getItem('project')).toBe('project-2');

		saveSelectedProjectId(storage, 'project', '   ');
		expect(storage.getItem('project')).toBeNull();

		const brokenStorage = {
			removeItem() {
				throw new Error('boom');
			},
			setItem() {
				throw new Error('boom');
			}
		} as unknown as Storage;

		expect(() => saveSelectedProjectId(brokenStorage, 'project', 'project-3')).not.toThrow();
		expect(() => saveSelectedProjectId(brokenStorage, 'project', '')).not.toThrow();
	});
});
