import { HTTP_STATUS } from '@simple-gantt/shared/http-status';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { toApiUser, toApiUserSummary } from '../../api/serializers';
import { readJson } from '../../http/utils';
import {
	createUserUseCase,
	deleteUserUseCase,
	listUsersUseCase,
	listUserSummariesUseCase,
	updateUserUseCase,
	UserModelValidationError,
	UserOptimisticLockError
} from './usecases';
import { createUserSchema, updateUserSchema } from './schemas';

function handleUserValidationError(error: unknown): never {
	if (error instanceof UserModelValidationError) {
		throw new HTTPException(HTTP_STATUS.BAD_REQUEST, { message: error.message });
	}
	if (error instanceof UserOptimisticLockError) {
		throw new HTTPException(HTTP_STATUS.CONFLICT, { message: error.message });
	}
	throw error;
}

export async function listUsersController(c: Context) {
	try {
		const users = await listUsersUseCase();
		return c.json(users.map(toApiUser));
	} catch (error) {
		handleUserValidationError(error);
	}
}

export async function listUserSummariesController(c: Context) {
	try {
		const users = await listUserSummariesUseCase();
		return c.json(users.map(toApiUserSummary));
	} catch (error) {
		handleUserValidationError(error);
	}
}

export async function createUserController(c: Context) {
	const payload = createUserSchema.parse(await readJson(c.req.raw));

	try {
		const created = await createUserUseCase(payload);
		return c.json(toApiUser(created), HTTP_STATUS.CREATED);
	} catch (error) {
		handleUserValidationError(error);
	}
}

export async function updateUserController(c: Context) {
	const userId = c.req.param('id');
	const payload = updateUserSchema.parse(await readJson(c.req.raw));

	try {
		const updated = await updateUserUseCase(userId, payload);
		if (!updated) {
			throw new HTTPException(HTTP_STATUS.NOT_FOUND, { message: 'user not found' });
		}
		return c.json(toApiUser(updated));
	} catch (error) {
		handleUserValidationError(error);
	}
}

export async function deleteUserController(c: Context) {
	const userId = c.req.param('id');

	try {
		const deleted = await deleteUserUseCase(userId);
		if (!deleted) {
			throw new HTTPException(HTTP_STATUS.NOT_FOUND, { message: 'user not found' });
		}
		return c.body(null, HTTP_STATUS.NO_CONTENT);
	} catch (error) {
		handleUserValidationError(error);
	}
}
