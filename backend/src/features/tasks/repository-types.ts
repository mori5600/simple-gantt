import type { Prisma as PrismaType, PrismaClient as PrismaClientType } from '@prisma/client';

export type DbClient = PrismaClientType | PrismaType.TransactionClient;

export type PredecessorTaskRecord = {
	id: string;
	predecessorTaskId: string | null;
};

export const taskInclude = {
	assignees: {
		select: {
			userId: true
		}
	}
} as const;

export type TaskWithAssignees = PrismaType.TaskGetPayload<{
	include: typeof taskInclude;
}>;
