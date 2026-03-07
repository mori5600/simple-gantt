import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePollIntervalMs, startVisibilityPolling } from './polling';

describe('polling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it('should run polls on interval when enabled', async () => {
		const onPoll = vi.fn().mockResolvedValue(undefined);
		const controller = startVisibilityPolling({
			intervalMs: 1_000,
			onPoll,
			isEnabled: () => true
		});

		await vi.advanceTimersByTimeAsync(3_000);

		expect(onPoll).toHaveBeenCalledTimes(3);
		controller.stop();
	});

	it('should skip polls when disabled', async () => {
		const onPoll = vi.fn().mockResolvedValue(undefined);
		const controller = startVisibilityPolling({
			intervalMs: 1_000,
			onPoll,
			isEnabled: () => false
		});

		await vi.advanceTimersByTimeAsync(3_000);

		expect(onPoll).not.toHaveBeenCalled();
		controller.stop();
	});

	it('should not overlap poll executions while a poll is running', async () => {
		let resolveCurrentPoll!: (value: void | PromiseLike<void>) => void;
		let hasRunningPoll = false;
		const onPoll = vi.fn(() => {
			return new Promise<void>((resolve) => {
				hasRunningPoll = true;
				resolveCurrentPoll = resolve;
			});
		});

		const controller = startVisibilityPolling({
			intervalMs: 1_000,
			onPoll,
			isEnabled: () => true
		});

		await vi.advanceTimersByTimeAsync(1_000);
		expect(onPoll).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(3_000);
		expect(onPoll).toHaveBeenCalledTimes(1);
		expect(hasRunningPoll).toBe(true);
		resolveCurrentPoll(undefined);
		await Promise.resolve();

		await vi.advanceTimersByTimeAsync(1_000);
		expect(onPoll).toHaveBeenCalledTimes(2);
		controller.stop();
	});

	it('resolvePollIntervalMs should fall back to default for too-small values', () => {
		vi.stubEnv('VITE_GANTT_SYNC_INTERVAL_MS', '500');

		expect(resolvePollIntervalMs(15_000, 'VITE_GANTT_SYNC_INTERVAL_MS')).toBe(15_000);
	});

	it('should skip polling while the document is hidden and resume on visibilitychange', async () => {
		let onVisibilityChange: (() => void) | null = null;
		const addEventListener = vi.fn((event: string, listener: () => void) => {
			if (event === 'visibilitychange') {
				onVisibilityChange = listener;
			}
		});
		const removeEventListener = vi.fn();
		vi.stubGlobal('document', {
			visibilityState: 'hidden',
			addEventListener,
			removeEventListener
		});
		const onPoll = vi.fn().mockResolvedValue(undefined);

		const controller = startVisibilityPolling({
			intervalMs: 1_000,
			onPoll,
			isEnabled: () => true
		});

		await controller.trigger();
		expect(onPoll).not.toHaveBeenCalled();

		Object.assign(document, { visibilityState: 'visible' });
		const visibilityHandler = onVisibilityChange as (() => void) | null;
		if (visibilityHandler) {
			visibilityHandler();
		}
		await Promise.resolve();

		expect(onPoll).toHaveBeenCalledOnce();
		controller.stop();
		expect(removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
	});

	it('should forward poll errors and allow stop to be called twice', async () => {
		const onError = vi.fn();
		const onPoll = vi.fn().mockRejectedValue(new Error('poll failed'));
		const controller = startVisibilityPolling({
			intervalMs: 1_000,
			onPoll,
			onError,
			isEnabled: () => true
		});

		await controller.trigger();

		expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'poll failed' }));

		controller.stop();
		controller.stop();
	});
});
