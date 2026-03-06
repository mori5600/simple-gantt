import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type IndexMocks = {
	createAppMock: ReturnType<typeof vi.fn>;
	exitSpy: ReturnType<typeof vi.spyOn>;
	getCurrentLogFilePathMock: ReturnType<typeof vi.fn>;
	initializeDatabaseMock: ReturnType<typeof vi.fn>;
	registeredHandlers: Map<string, () => void>;
	serveMock: ReturnType<typeof vi.fn>;
};

async function importIndexModule(options?: {
	apiPort?: string;
	initializeDatabaseError?: Error;
}) {
	const createAppMock = vi.fn(() => ({
		fetch: vi.fn()
	}));
	const getCurrentLogFilePathMock = vi.fn(() => '/tmp/backend.log');
	const initializeDatabaseMock =
		options?.initializeDatabaseError === undefined
			? vi.fn().mockResolvedValue(undefined)
			: vi.fn().mockRejectedValue(options.initializeDatabaseError);
	const loggerMock = {
		error: vi.fn(),
		info: vi.fn()
	};
	const prismaMock = {
		$disconnect: vi.fn().mockResolvedValue(undefined)
	};
	const serveMock = vi.fn((config: { port: number }, onListen: (info: { port: number }) => void) => {
		onListen({ port: config.port });
	});
	const registeredHandlers = new Map<string, () => void>();

	vi.doMock('./app', () => ({
		createApp: createAppMock
	}));
	vi.doMock('@hono/node-server', () => ({
		serve: serveMock
	}));
	vi.doMock('./platform/logger', () => ({
		getCurrentLogFilePath: getCurrentLogFilePathMock,
		logger: loggerMock
	}));
	vi.doMock('./platform/prisma', () => ({
		initializeDatabase: initializeDatabaseMock,
		prisma: prismaMock
	}));

	const onSpy = vi
		.spyOn(process, 'on')
		.mockImplementation(((event: string, handler: () => void) => {
			registeredHandlers.set(event, handler);
			return process;
		}) as unknown as typeof process.on);
	const exitSpy = vi
		.spyOn(process, 'exit')
		.mockImplementation(((code?: number) => undefined as never) as (code?: number) => never);

	if (options?.apiPort) {
		process.env.API_PORT = options.apiPort;
	} else {
		delete process.env.API_PORT;
	}

	await import('./index');
	await Promise.resolve();
	await Promise.resolve();

	return {
		createAppMock,
		exitSpy,
		getCurrentLogFilePathMock,
		initializeDatabaseMock,
		loggerMock,
		onSpy,
		prismaMock,
		registeredHandlers,
		serveMock
	};
}

describe('index bootstrap', () => {
	beforeEach(() => {
		vi.resetModules();
		delete process.env.API_PORT;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should initialize the database, start the server, and register shutdown handlers', async () => {
		const mocks = await importIndexModule({ apiPort: '9999' });

		expect(mocks.createAppMock).toHaveBeenCalledTimes(1);
		expect(mocks.initializeDatabaseMock).toHaveBeenCalledTimes(1);
		expect(mocks.serveMock).toHaveBeenCalledWith(
			expect.objectContaining({
				fetch: expect.any(Function),
				port: 9999
			}),
			expect.any(Function)
		);
		expect(mocks.getCurrentLogFilePathMock).toHaveBeenCalledTimes(1);
		expect(mocks.registeredHandlers.has('SIGINT')).toBe(true);
		expect(mocks.registeredHandlers.has('SIGTERM')).toBe(true);
		expect(mocks.loggerMock.info).toHaveBeenCalledWith(
			{
				port: 9999,
				logFilePath: '/tmp/backend.log'
			},
			'API server started'
		);

		mocks.registeredHandlers.get('SIGINT')?.();
		mocks.registeredHandlers.get('SIGTERM')?.();
		await Promise.resolve();
		await Promise.resolve();

		expect(mocks.prismaMock.$disconnect).toHaveBeenCalledTimes(2);
		expect(mocks.loggerMock.info).toHaveBeenCalledWith(
			{ signal: 'SIGINT' },
			'Shutdown signal received'
		);
		expect(mocks.loggerMock.info).toHaveBeenCalledWith(
			{ signal: 'SIGTERM' },
			'Shutdown signal received'
		);
		expect(mocks.loggerMock.info).toHaveBeenCalledWith('Database connection closed');
		expect(mocks.exitSpy).toHaveBeenCalledWith(0);
	});

	it('should log startup failures and exit with status 1', async () => {
		const error = new Error('db init failed');
		const mocks = await importIndexModule({ initializeDatabaseError: error });

		expect(mocks.initializeDatabaseMock).toHaveBeenCalledTimes(1);
		expect(mocks.serveMock).not.toHaveBeenCalled();
		expect(mocks.loggerMock.error).toHaveBeenCalledWith(
			{
				err: error
			},
			'Failed to initialize database'
		);
		expect(mocks.exitSpy).toHaveBeenCalledWith(1);
	});
});
