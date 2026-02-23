import prismaClientPackage from '@prisma/client';
import type { PrismaClient as PrismaClientType } from '@prisma/client';

const { PrismaClient } = prismaClientPackage;
const DEFAULT_SQLITE_BUSY_TIMEOUT_MS = 5000;

const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClientType;
};

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

function isSqliteUrl(databaseUrl: string | undefined): boolean {
	return typeof databaseUrl === 'string' && databaseUrl.startsWith('file:');
}

function resolveSqliteBusyTimeoutMs(rawTimeout: string | undefined): number {
	if (!rawTimeout) {
		return DEFAULT_SQLITE_BUSY_TIMEOUT_MS;
	}

	const parsed = Number.parseInt(rawTimeout, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return DEFAULT_SQLITE_BUSY_TIMEOUT_MS;
	}

	return parsed;
}

export async function initializeDatabase(): Promise<void> {
	await prisma.$connect();

	if (!isSqliteUrl(process.env.DATABASE_URL)) {
		return;
	}

	const busyTimeoutMs = resolveSqliteBusyTimeoutMs(process.env.SQLITE_BUSY_TIMEOUT_MS);

	await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
	await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = ${busyTimeoutMs};`);
}
