import type { Prisma as PrismaType, PrismaClient as PrismaClientType } from '@prisma/client';
import { prisma } from './db';

type DbClient = PrismaClientType | PrismaType.TransactionClient;

export type UserRecord = {
	id: string;
	name: string;
	updatedAt: Date;
};

export type UserSummaryRecord = UserRecord & {
	taskCount: number;
};

export async function listUsers(db: DbClient = prisma): Promise<UserRecord[]> {
	return db.user.findMany({
		orderBy: [{ name: 'asc' }, { id: 'asc' }]
	});
}

export async function listUsersWithTaskCount(db: DbClient = prisma): Promise<UserSummaryRecord[]> {
	const users = await db.user.findMany({
		orderBy: [{ name: 'asc' }, { id: 'asc' }],
		select: {
			id: true,
			name: true,
			updatedAt: true,
			_count: {
				select: {
					assignees: true
				}
			}
		}
	});

	return users.map((user) => ({
		id: user.id,
		name: user.name,
		updatedAt: user.updatedAt,
		taskCount: user._count.assignees
	}));
}

export async function createUserRecord(
	params: { id: string; name: string },
	db: DbClient = prisma
): Promise<UserRecord> {
	const created = await db.user.create({
		data: {
			id: params.id,
			name: params.name
		}
	});

	return {
		id: created.id,
		name: created.name,
		updatedAt: created.updatedAt
	};
}

export async function findUserById(
	userId: string,
	db: DbClient = prisma
): Promise<UserRecord | null> {
	return db.user.findUnique({
		where: {
			id: userId
		},
		select: {
			id: true,
			name: true,
			updatedAt: true
		}
	});
}

export async function updateUserWhereUpdatedAt(
	params: {
		userId: string;
		expectedUpdatedAt: Date;
		name: string;
	},
	db: DbClient = prisma
): Promise<number> {
	const updateResult = await db.user.updateMany({
		where: {
			id: params.userId,
			updatedAt: params.expectedUpdatedAt
		},
		data: {
			name: params.name
		}
	});
	return updateResult.count;
}

export async function updateUserById(
	userId: string,
	name: string,
	db: DbClient = prisma
): Promise<UserRecord> {
	const updated = await db.user.update({
		where: {
			id: userId
		},
		data: {
			name
		},
		select: {
			id: true,
			name: true,
			updatedAt: true
		}
	});
	return updated;
}

export async function findUserUpdatedAtById(
	userId: string,
	db: DbClient = prisma
): Promise<Date | null> {
	const latest = await db.user.findUnique({
		where: {
			id: userId
		},
		select: {
			updatedAt: true
		}
	});
	return latest?.updatedAt ?? null;
}

export async function findUserAssigneeCountById(
	userId: string,
	db: DbClient = prisma
): Promise<number | null> {
	const existing = await db.user.findUnique({
		where: {
			id: userId
		},
		select: {
			id: true,
			_count: {
				select: {
					assignees: true
				}
			}
		}
	});
	if (!existing) {
		return null;
	}
	return existing._count.assignees;
}

export async function deleteUserById(userId: string, db: DbClient = prisma): Promise<void> {
	await db.user.delete({
		where: {
			id: userId
		}
	});
}
