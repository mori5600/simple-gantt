import type { Prisma as PrismaType, PrismaClient as PrismaClientType } from '@prisma/client';
import { prisma } from '../../platform/prisma';
import type { UserRecord } from '../users/repository';

type DbClient = PrismaClientType | PrismaType.TransactionClient;

export type ProjectRecord = {
	id: string;
	name: string;
	sortOrder: number;
	updatedAt: Date;
};

export type ProjectSummaryRecord = ProjectRecord & {
	taskCount: number;
};

export async function nextProjectSortOrder(db: DbClient = prisma): Promise<number> {
	const result = await db.project.aggregate({
		_max: {
			sortOrder: true
		}
	});
	return (result._max.sortOrder ?? -1) + 1;
}

export async function listProjects(db: DbClient = prisma): Promise<ProjectRecord[]> {
	return db.project.findMany({
		orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }]
	});
}

export async function listProjectsWithTaskCount(
	db: DbClient = prisma
): Promise<ProjectSummaryRecord[]> {
	const projects = await db.project.findMany({
		orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
		select: {
			id: true,
			name: true,
			sortOrder: true,
			updatedAt: true,
			_count: {
				select: {
					tasks: true
				}
			}
		}
	});

	return projects.map((project) => ({
		id: project.id,
		name: project.name,
		sortOrder: project.sortOrder,
		updatedAt: project.updatedAt,
		taskCount: project._count.tasks
	}));
}

export async function createProjectRecord(
	params: { id: string; name: string; sortOrder: number },
	db: DbClient = prisma
): Promise<ProjectRecord> {
	const created = await db.project.create({
		data: {
			id: params.id,
			name: params.name,
			sortOrder: params.sortOrder
		}
	});

	return {
		id: created.id,
		name: created.name,
		sortOrder: created.sortOrder,
		updatedAt: created.updatedAt
	};
}

export async function findProjectById(
	projectId: string,
	db: DbClient = prisma
): Promise<ProjectRecord | null> {
	return db.project.findUnique({
		where: {
			id: projectId
		},
		select: {
			id: true,
			name: true,
			sortOrder: true,
			updatedAt: true
		}
	});
}

export async function updateProjectWhereUpdatedAt(
	params: {
		projectId: string;
		expectedUpdatedAt: Date;
		name: string;
	},
	db: DbClient = prisma
): Promise<number> {
	const updateResult = await db.project.updateMany({
		where: {
			id: params.projectId,
			updatedAt: params.expectedUpdatedAt
		},
		data: {
			name: params.name
		}
	});
	return updateResult.count;
}

export async function updateProjectById(
	projectId: string,
	name: string,
	db: DbClient = prisma
): Promise<ProjectRecord> {
	const updated = await db.project.update({
		where: {
			id: projectId
		},
		data: {
			name
		},
		select: {
			id: true,
			name: true,
			sortOrder: true,
			updatedAt: true
		}
	});
	return updated;
}

export async function findProjectUpdatedAtById(
	projectId: string,
	db: DbClient = prisma
): Promise<Date | null> {
	const latest = await db.project.findUnique({
		where: {
			id: projectId
		},
		select: {
			updatedAt: true
		}
	});
	return latest?.updatedAt ?? null;
}

export async function findProjectTaskCountById(
	projectId: string,
	db: DbClient = prisma
): Promise<number | null> {
	const existing = await db.project.findUnique({
		where: {
			id: projectId
		},
		select: {
			id: true,
			_count: {
				select: {
					tasks: true
				}
			}
		}
	});
	if (!existing) {
		return null;
	}
	return existing._count.tasks;
}

export async function deleteProjectById(
	projectId: string,
	db: DbClient = prisma
): Promise<boolean> {
	const result = await db.project.deleteMany({
		where: {
			id: projectId
		}
	});
	return result.count > 0;
}

export async function listProjectIds(db: DbClient = prisma): Promise<string[]> {
	return (
		await db.project.findMany({
			select: {
				id: true
			}
		})
	).map((project) => project.id);
}

export async function updateProjectSortOrder(
	projectId: string,
	sortOrder: number,
	db: DbClient = prisma
): Promise<void> {
	await db.project.update({
		where: {
			id: projectId
		},
		data: {
			sortOrder
		}
	});
}

export async function listProjectMemberUserIds(
	projectId: string,
	db: DbClient = prisma
): Promise<string[]> {
	return (
		await db.projectMember.findMany({
			where: {
				projectId
			},
			select: {
				userId: true
			}
		})
	).map((member) => member.userId);
}

export async function listProjectMembers(
	projectId: string,
	db: DbClient = prisma
): Promise<UserRecord[]> {
	return db.user.findMany({
		where: {
			projectMemberships: {
				some: {
					projectId
				}
			}
		},
		orderBy: [{ name: 'asc' }, { id: 'asc' }],
		select: {
			id: true,
			name: true,
			updatedAt: true
		}
	});
}

export async function countUsersByIds(userIds: string[], db: DbClient = prisma): Promise<number> {
	if (userIds.length === 0) {
		return 0;
	}

	return db.user.count({
		where: {
			id: {
				in: userIds
			}
		}
	});
}

export async function countTaskAssignmentsForUsersInProject(
	projectId: string,
	userIds: string[],
	db: DbClient = prisma
): Promise<number> {
	if (userIds.length === 0) {
		return 0;
	}

	return db.taskAssignee.count({
		where: {
			userId: {
				in: userIds
			},
			task: {
				projectId
			}
		}
	});
}

export async function replaceProjectMembers(
	projectId: string,
	userIds: string[],
	db: DbClient = prisma
): Promise<void> {
	await db.projectMember.deleteMany({
		where: {
			projectId
		}
	});

	if (userIds.length === 0) {
		return;
	}

	await db.projectMember.createMany({
		data: userIds.map((userId) => ({
			projectId,
			userId
		}))
	});
}
