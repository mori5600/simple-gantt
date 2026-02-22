import type { CreateUserInput, UpdateUserInput } from '@simple-gantt/shared/tasks';
import {
	createUserRecord,
	deleteUserById,
	findUserAssigneeCountById,
	findUserById,
	findUserUpdatedAtById,
	listUsers,
	listUsersWithTaskCount,
	updateUserById,
	updateUserWhereUpdatedAt,
	type UserRecord,
	type UserSummaryRecord
} from '../models/user-model';

/**
 * ユースケース層で検出した業務制約違反を、実行時障害と区別して扱うための例外。
 */
export class UserModelValidationError extends Error {}
/**
 * 同時編集で他ユーザーの更新を上書きしないための楽観ロック例外。
 */
export class UserOptimisticLockError extends Error {}

/**
 * ユーザー管理画面の基準データとして、永続化されたユーザー一覧をそのまま返す。
 */
export async function listUsersUseCase(): Promise<UserRecord[]> {
	return listUsers();
}

/**
 * 一覧表示で task 件数を即時表示できるよう、集約済みユーザー情報を返す。
 */
export async function listUserSummariesUseCase(): Promise<UserSummaryRecord[]> {
	return listUsersWithTaskCount();
}

/**
 * ユーザー作成時に種別接頭辞付き ID を統一し、他エンティティとの識別を簡潔にする。
 */
export async function createUserUseCase(payload: CreateUserInput): Promise<UserRecord> {
	return createUserRecord({
		id: `user-${crypto.randomUUID()}`,
		name: payload.name
	});
}

/**
 * 楽観ロックで user 名更新を保護し、同時更新時の更新ロストを防ぐ。
 */
export async function updateUserUseCase(
	userId: string,
	payload: UpdateUserInput
): Promise<UserRecord | null> {
	const expectedUpdatedAt = new Date(payload.updatedAt);
	const existing = await findUserById(userId);
	if (!existing) {
		return null;
	}

	if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
		throw new UserOptimisticLockError(
			'user は他ユーザーによって更新されました。再読み込みして再度お試しください。'
		);
	}

	const nextName = payload.name ?? existing.name;
	if (nextName === existing.name) {
		return existing;
	}

	const updatedCount = await updateUserWhereUpdatedAt({
		userId,
		expectedUpdatedAt,
		name: nextName
	});

	if (updatedCount === 0) {
		const latestUpdatedAt = await findUserUpdatedAtById(userId);
		if (!latestUpdatedAt) {
			return null;
		}

		if (latestUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
			throw new UserOptimisticLockError(
				'user は他ユーザーによって更新されました。再読み込みして再度お試しください。'
			);
		}
	}

	return updateUserById(userId, nextName);
}

/**
 * 既存 task に割り当て済みの user を削除させず、担当者参照の整合性を守る。
 */
export async function deleteUserUseCase(userId: string): Promise<boolean> {
	const assigneeCount = await findUserAssigneeCountById(userId);
	if (assigneeCount === null) {
		return false;
	}

	if (assigneeCount > 0) {
		throw new UserModelValidationError('担当タスクが存在するユーザーは削除できません。');
	}

	await deleteUserById(userId);
	return true;
}
