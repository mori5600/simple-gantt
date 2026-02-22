import { normalizeClientEnvValue, readClientEnv } from '$lib/env';

type PollingOptions = {
	intervalMs: number;
	onPoll: () => Promise<void> | void;
	onError?: (error: unknown) => void;
	isEnabled?: () => boolean;
};

export type VisibilityPollingController = {
	stop: () => void;
	trigger: () => Promise<void>;
};

export function resolvePollIntervalMs(defaultMs: number, ...keys: string[]): number {
	const rawValue = normalizeClientEnvValue(readClientEnv(...keys));
	if (!rawValue) {
		return defaultMs;
	}

	const parsed = Number(rawValue);
	if (!Number.isFinite(parsed)) {
		return defaultMs;
	}

	const intervalMs = Math.floor(parsed);
	if (intervalMs < 1_000) {
		return defaultMs;
	}

	return intervalMs;
}

export function startVisibilityPolling(options: PollingOptions): VisibilityPollingController {
	const { intervalMs, onPoll, onError, isEnabled } = options;
	let stopped = false;
	let running = false;

	const runPoll = async (): Promise<void> => {
		if (stopped || running) {
			return;
		}
		if (isEnabled && !isEnabled()) {
			return;
		}
		if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
			return;
		}

		running = true;
		try {
			await onPoll();
		} catch (error) {
			onError?.(error);
		} finally {
			running = false;
		}
	};

	const onVisibilityChange = (): void => {
		if (document.visibilityState === 'visible') {
			void runPoll();
		}
	};

	const intervalId = setInterval(() => {
		void runPoll();
	}, intervalMs);

	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', onVisibilityChange);
	}

	return {
		stop: () => {
			if (stopped) {
				return;
			}
			stopped = true;
			clearInterval(intervalId);
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', onVisibilityChange);
			}
		},
		trigger: runPoll
	};
}
