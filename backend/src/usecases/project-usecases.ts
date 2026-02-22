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

/**
 * ユースケース層の入力不備をインフラ例外と分離し、HTTP 層で業務エラーとして扱うための例外。
 */
export class ProjectModelValidationError extends Error {}
/**
 * 同一 project への同時更新で更新ロストが起きるのを防ぐための例外。
 */
export class ProjectOptimisticLockError extends Error {}

/**
 * 並び順を含む project 一覧の現在状態を取得する。
 * UI 側で再並び替えや差分反映の基準に使うため、加工せず永続層の順序を返す。
 */
export async function listProjectsUseCase(): Promise<ProjectRecord[]> {
	return listProjects();
}

/**
 * project 一覧画面で件数バッジを追加クエリなしに描画できるよう、
 * task 件数を含む集約結果を返す。
 */
export async function listProjectSummariesUseCase(): Promise<ProjectSummaryRecord[]> {
	return listProjectsWithTaskCount();
}

/**
 * 新規 project を既存 project 群の末尾に追加する。
 * sortOrder をここで確定し、表示順の決定ロジックを呼び出し側へ漏らさない。
 */
export async function createProjectUseCase(payload: CreateProjectInput): Promise<ProjectRecord> {
	return createProjectRecord({
		id: `project-${crypto.randomUUID()}`,
		name: payload.name,
		sortOrder: await nextProjectSortOrder()
	});
}

/**
 * 楽観ロックで project 名の更新を直列化し、最後に保存した値が
 * 無言で上書きされる事故を防ぐ。
 */
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

/**
 * タスクを保持した project の削除を禁止し、計画データの参照一貫性を守る。
 */
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

/**
 * 並び替え入力を「全件の完全順序」として検証してから反映する。
 * 部分更新を許すと重複や欠落順序が生まれるため、全件一致を必須にする。
 */
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
