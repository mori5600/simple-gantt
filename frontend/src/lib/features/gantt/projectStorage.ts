function normalizeProjectId(value: unknown): string {
	if (typeof value !== 'string') {
		return '';
	}
	return value.trim();
}

export function loadSelectedProjectId(storage: Storage, storageKey: string): string {
	try {
		return normalizeProjectId(storage.getItem(storageKey));
	} catch {
		return '';
	}
}

export function saveSelectedProjectId(
	storage: Storage,
	storageKey: string,
	projectId: string
): void {
	try {
		const normalized = normalizeProjectId(projectId);
		if (normalized.length === 0) {
			storage.removeItem(storageKey);
			return;
		}
		storage.setItem(storageKey, normalized);
	} catch {
		// ignore persistence failures
	}
}
