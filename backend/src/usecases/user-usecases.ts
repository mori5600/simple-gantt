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

export class UserModelValidationError extends Error {}
export class UserOptimisticLockError extends Error {}

export async function listUsersUseCase(): Promise<UserRecord[]> {
	return listUsers();
}

export async function listUserSummariesUseCase(): Promise<UserSummaryRecord[]> {
	return listUsersWithTaskCount();
}

export async function createUserUseCase(payload: CreateUserInput): Promise<UserRecord> {
	return createUserRecord({
		id: `user-${crypto.randomUUID()}`,
		name: payload.name
	});
}

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
