import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { readJson } from '../lib/http';
import {
	createUserUseCase,
	deleteUserUseCase,
	listUsersUseCase,
	listUserSummariesUseCase,
	updateUserUseCase,
	UserModelValidationError,
	UserOptimisticLockError
} from '../usecases/user-usecases';
import { createUserSchema, updateUserSchema } from '../schemas/user-schemas';
import { toApiUser, toApiUserSummary } from '../serializers/serializers';

function handleUserValidationError(error: unknown): never {
	if (error instanceof UserModelValidationError) {
		throw new HTTPException(400, { message: error.message });
	}
	if (error instanceof UserOptimisticLockError) {
		throw new HTTPException(409, { message: error.message });
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
		return c.json(toApiUser(created), 201);
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
			throw new HTTPException(404, { message: 'user not found' });
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
			throw new HTTPException(404, { message: 'user not found' });
		}
		return c.body(null, 204);
	} catch (error) {
		handleUserValidationError(error);
	}
}
