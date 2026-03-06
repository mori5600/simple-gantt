import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockLogger = {
	destination: {
		end: (callback?: (error?: Error | null) => void) => void;
		write: (chunk: string) => boolean;
	};
	end: () => Promise<void>;
	info: (payload: unknown) => boolean;
	options: {
		level: string;
		timestamp: unknown;
	};
};

async function importLoggerModule(writeResults: boolean[] = [true]) {
	const mkdirSyncMock = vi.fn();
	const createWriteStreamMock = vi.fn();
	const streams: Array<EventEmitter & {
		end: ReturnType<typeof vi.fn>;
		path: string;
		write: ReturnType<typeof vi.fn>;
	}> = [];

	createWriteStreamMock.mockImplementation((path: string) => {
		const stream = new EventEmitter() as EventEmitter & {
			end: ReturnType<typeof vi.fn>;
			path: string;
			write: ReturnType<typeof vi.fn>;
		};
		stream.path = path;
		stream.write = vi.fn().mockImplementation(() => writeResults.shift() ?? true);
		stream.end = vi.fn((callback?: () => void) => {
			callback?.();
		});
		streams.push(stream);
		return stream;
	});

	const pinoMock = vi.fn((options: MockLogger['options'], destination: MockLogger['destination']) => ({
		destination,
		end: () =>
			new Promise<void>((resolve, reject) => {
				destination.end((error?: Error | null) => {
					if (error) {
						reject(error);
						return;
					}
					resolve();
				});
			}),
		info: (payload: unknown) => destination.write(`${JSON.stringify(payload)}\n`),
		options
	}));
	(pinoMock as unknown as { stdTimeFunctions: { isoTime: () => string } }).stdTimeFunctions = {
		isoTime: () => 'iso-time'
	};

	vi.doMock('node:fs', () => ({
		createWriteStream: createWriteStreamMock,
		mkdirSync: mkdirSyncMock
	}));
	vi.doMock('pino', () => ({
		default: pinoMock
	}));

	const module = await import('./logger');
	return { createWriteStreamMock, mkdirSyncMock, module, pinoMock, streams };
}

describe('logger platform', () => {
	beforeEach(() => {
		vi.resetModules();
		delete process.env.LOG_LEVEL;
		delete process.env.NODE_ENV;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should create the logs directory and expose the current log file path', async () => {
		process.env.NODE_ENV = 'development';
		process.env.LOG_LEVEL = 'trace';
		const { mkdirSyncMock, module, pinoMock, streams } = await importLoggerModule();
		const logger = module.logger as unknown as MockLogger;

		const path = module.getCurrentLogFilePath();

		expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringMatching(/backend\/logs$/), {
			recursive: true
		});
		expect(path).toMatch(/backend-\d{4}-\d{2}-\d{2}\.log$/);
		expect(streams[0]?.path).toBe(path);
		expect(pinoMock).toHaveBeenCalledTimes(1);
		expect(logger.options.level).toBe('trace');
	});

	it('should default to info level in production when LOG_LEVEL is not set', async () => {
		process.env.NODE_ENV = 'production';

		const { module } = await importLoggerModule();
		const logger = module.logger as unknown as MockLogger;

		expect(logger.options.level).toBe('info');
	});

	it('should wait for drain when the underlying stream applies backpressure', async () => {
		const { module, streams } = await importLoggerModule([false]);
		const logger = module.logger as unknown as MockLogger;

		logger.info({ event: 'backpressure' });

		expect(streams[0]?.listenerCount('drain')).toBe(1);
		streams[0]?.emit('drain');
		expect(streams[0]?.listenerCount('drain')).toBe(0);
	});

	it('should close the active stream when the logger destination ends', async () => {
		const { module, streams } = await importLoggerModule();
		const logger = module.logger as unknown as MockLogger;

		module.getCurrentLogFilePath();
		await logger.end();

		expect(streams[0]?.end).toHaveBeenCalledTimes(1);
	});

	it('should allow ending the destination before any stream is created', async () => {
		const { module, streams } = await importLoggerModule();
		const logger = module.logger as unknown as MockLogger;

		await logger.end();

		expect(streams).toHaveLength(0);
	});
});
