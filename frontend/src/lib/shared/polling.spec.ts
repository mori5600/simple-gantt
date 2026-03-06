import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startVisibilityPolling } from './polling';

describe('polling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
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
});
