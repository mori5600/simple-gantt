import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockPrismaInstance = {
	options: {
		log: string[];
	};
	$connect: ReturnType<typeof vi.fn>;
	$disconnect: ReturnType<typeof vi.fn>;
	$queryRawUnsafe: ReturnType<typeof vi.fn>;
};

async function importPrismaModule() {
	const instances: MockPrismaInstance[] = [];

	class PrismaClientMock {
		options: {
			log: string[];
		};
		$connect = vi.fn().mockResolvedValue(undefined);
		$disconnect = vi.fn().mockResolvedValue(undefined);
		$queryRawUnsafe = vi.fn().mockResolvedValue(undefined);

		constructor(options: { log: string[] }) {
			this.options = options;
			instances.push(this as unknown as MockPrismaInstance);
		}
	}

	vi.doMock('@prisma/client', () => ({
		default: { PrismaClient: PrismaClientMock },
		PrismaClient: PrismaClientMock
	}));

	const module = await import('./prisma');
	return { instances, module };
}

describe('prisma platform', () => {
	beforeEach(() => {
		vi.resetModules();
		delete process.env.DATABASE_URL;
		delete process.env.NODE_ENV;
		delete process.env.SQLITE_BUSY_TIMEOUT_MS;
		delete (globalThis as { prisma?: unknown }).prisma;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete (globalThis as { prisma?: unknown }).prisma;
	});

	it('should create and cache a development Prisma client', async () => {
		process.env.NODE_ENV = 'development';
		process.env.DATABASE_URL = 'postgresql://db.example/app';

		const { instances, module } = await importPrismaModule();
		const client = module.prisma as unknown as MockPrismaInstance;

		expect(instances).toHaveLength(1);
		expect(instances[0].options).toEqual({ log: ['warn', 'error'] });
		expect((globalThis as { prisma?: unknown }).prisma).toBe(module.prisma);

		await module.initializeDatabase();

		expect(client.$connect).toHaveBeenCalledTimes(1);
		expect(client.$queryRawUnsafe).not.toHaveBeenCalled();
	});

	it('should reuse a cached Prisma client and apply sqlite pragmas', async () => {
		const cachedClient = {
			$connect: vi.fn().mockResolvedValue(undefined),
			$disconnect: vi.fn().mockResolvedValue(undefined),
			$queryRawUnsafe: vi.fn().mockResolvedValue(undefined)
		};
		(globalThis as { prisma?: unknown }).prisma = cachedClient;
		process.env.NODE_ENV = 'test';
		process.env.DATABASE_URL = 'file:test.db';
		process.env.SQLITE_BUSY_TIMEOUT_MS = '1500';

		const { instances, module } = await importPrismaModule();

		expect(instances).toHaveLength(0);
		expect(module.prisma).toBe(cachedClient);

		await module.initializeDatabase();

		expect(cachedClient.$connect).toHaveBeenCalledTimes(1);
		expect(cachedClient.$queryRawUnsafe).toHaveBeenNthCalledWith(1, 'PRAGMA journal_mode = WAL;');
		expect(cachedClient.$queryRawUnsafe).toHaveBeenNthCalledWith(
			2,
			'PRAGMA busy_timeout = 1500;'
		);
	});

	it('should default sqlite busy timeout when environment variable is missing', async () => {
		process.env.NODE_ENV = 'production';
		process.env.DATABASE_URL = 'file:test.db';

		const { instances, module } = await importPrismaModule();
		const client = instances[0];

		expect((globalThis as { prisma?: unknown }).prisma).toBeUndefined();
		expect(client.options).toEqual({ log: ['error'] });

		await module.initializeDatabase();

		expect(client.$queryRawUnsafe).toHaveBeenNthCalledWith(2, 'PRAGMA busy_timeout = 5000;');
	});

	it('should default sqlite busy timeout when the configured value is invalid', async () => {
		process.env.NODE_ENV = 'production';
		process.env.DATABASE_URL = 'file:test.db';
		process.env.SQLITE_BUSY_TIMEOUT_MS = '-1';

		const { instances, module } = await importPrismaModule();
		const client = instances[0];

		await module.initializeDatabase();

		expect(client.$queryRawUnsafe).toHaveBeenNthCalledWith(2, 'PRAGMA busy_timeout = 5000;');
	});
});
