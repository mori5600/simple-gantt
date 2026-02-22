import type { CreateProjectInput, UpdateProjectInput } from '@simple-gantt/shared/tasks';
import {
	createProjectRecord,
	deleteProjectById,
	findProjectById,
	findProjectTaskCountById,
	findProjectUpdatedAtById,
	listProjects,
	listProjectsWithTaskCount,
	listProjectIds,
	nextProjectSortOrder,
	type ProjectRecord,
	type ProjectSummaryRecord,
	updateProjectById,
	updateProjectSortOrder,
	updateProjectWhereUpdatedAt
} from '../models/project-model';
import { prisma } from '../models/db';

export class ProjectModelValidationError extends Error {}
export class ProjectOptimisticLockError extends Error {}

export async function listProjectsUseCase(): Promise<ProjectRecord[]> {
	return listProjects();
}

export async function listProjectSummariesUseCase(): Promise<ProjectSummaryRecord[]> {
	return listProjectsWithTaskCount();
}

export async function createProjectUseCase(payload: CreateProjectInput): Promise<ProjectRecord> {
	return createProjectRecord({
		id: `project-${crypto.randomUUID()}`,
		name: payload.name,
		sortOrder: await nextProjectSortOrder()
	});
}

export async function updateProjectUseCase(
	projectId: string,
	payload: UpdateProjectInput
): Promise<ProjectRecord | null> {
	const expectedUpdatedAt = new Date(payload.updatedAt);
	const existing = await findProjectById(projectId);
	if (!existing) {
		return null;
	}

	if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
		throw new ProjectOptimisticLockError(
			'project は他ユーザーによって更新されました。再読み込みして再度お試しください。'
		);
	}

	const nextName = payload.name ?? existing.name;
	if (nextName === existing.name) {
		return existing;
	}

	const updatedCount = await updateProjectWhereUpdatedAt({
		projectId,
		expectedUpdatedAt,
		name: nextName
	});

	if (updatedCount === 0) {
		const latestUpdatedAt = await findProjectUpdatedAtById(projectId);
		if (!latestUpdatedAt) {
			return null;
		}

		if (latestUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
			throw new ProjectOptimisticLockError(
				'project は他ユーザーによって更新されました。再読み込みして再度お試しください。'
			);
		}
	}

	return updateProjectById(projectId, nextName);
}

export async function deleteProjectUseCase(projectId: string): Promise<boolean> {
	const taskCount = await findProjectTaskCountById(projectId);
	if (taskCount === null) {
		return false;
	}

	if (taskCount > 0) {
		throw new ProjectModelValidationError('タスクが存在するプロジェクトは削除できません。');
	}

	await deleteProjectById(projectId);
	return true;
}

export async function reorderProjectsUseCase(ids: string[]): Promise<ProjectRecord[]> {
	const projectIds = new Set(await listProjectIds());
	if (projectIds.size !== ids.length) {
		throw new ProjectModelValidationError('ids の件数が project 件数と一致しません。');
	}

	for (const id of ids) {
		if (!projectIds.has(id)) {
			throw new ProjectModelValidationError(`project not found: ${id}`);
		}
	}

	await prisma.$transaction(async (tx) => {
		for (const [index, id] of ids.entries()) {
			await updateProjectSortOrder(id, index, tx);
		}
	});

	return listProjects();
}
