export const POLLING_SETTINGS_STORAGE_KEY = 'simple-gantt:polling-settings:v1';

export const POLLING_INTERVAL_OPTIONS = [5_000, 10_000, 15_000, 20_000, 30_000, 60_000] as const;

type PollingIntervalMs = (typeof POLLING_INTERVAL_OPTIONS)[number];

export type PollingSettings = {
	ganttIntervalMs: PollingIntervalMs | null;
	adminIntervalMs: PollingIntervalMs | null;
};

type PartialPollingSettings = Partial<PollingSettings>;

function isAllowedInterval(value: unknown): value is PollingIntervalMs {
	return typeof value === 'number' && POLLING_INTERVAL_OPTIONS.includes(value as PollingIntervalMs);
}

export function loadPollingSettings(storage: Storage | undefined): PartialPollingSettings {
	if (!storage) {
		return {};
	}

	const raw = storage.getItem(POLLING_SETTINGS_STORAGE_KEY);
	if (!raw) {
		return {};
	}

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') {
			return {};
		}

		const maybe = parsed as Record<string, unknown>;
		const settings: PartialPollingSettings = {};

		if (maybe.ganttIntervalMs === null || isAllowedInterval(maybe.ganttIntervalMs)) {
			settings.ganttIntervalMs = maybe.ganttIntervalMs;
		}
		if (maybe.adminIntervalMs === null || isAllowedInterval(maybe.adminIntervalMs)) {
			settings.adminIntervalMs = maybe.adminIntervalMs;
		}

		return settings;
	} catch {
		return {};
	}
}

export function savePollingSettings(storage: Storage | undefined, settings: PollingSettings): void {
	if (!storage) {
		return;
	}
	storage.setItem(POLLING_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function clearPollingSettings(storage: Storage | undefined): void {
	if (!storage) {
		return;
	}
	storage.removeItem(POLLING_SETTINGS_STORAGE_KEY);
}

export function resolvePollingIntervalForScope(params: {
	scope: 'gantt' | 'admin';
	defaultIntervalMs: number;
	storage: Storage | undefined;
}): number | null {
	const { scope, defaultIntervalMs, storage } = params;
	const settings = loadPollingSettings(storage);
	const configured = scope === 'gantt' ? settings.ganttIntervalMs : settings.adminIntervalMs;
	if (configured === null) {
		return null;
	}
	if (typeof configured === 'number') {
		return configured;
	}
	return defaultIntervalMs;
}
