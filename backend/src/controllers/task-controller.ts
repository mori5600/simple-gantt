import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { readJson } from '../lib/http';
import {
	createTaskUseCase,
	deleteTaskUseCase,
	listTaskHistoryUseCase,
	listTasksUseCase,
	ProjectNotFoundError,
	reorderTasksUseCase,
	TaskOptimisticLockError,
	TaskModelValidationError,
	updateTaskUseCase
} from '../usecases/task-usecases';
import { createTaskSchema, reorderTasksSchema, updateTaskSchema } from '../schemas/task-schemas';
import { toApiTask, toApiTaskHistory } from '../serializers/serializers';

function handleTaskValidationError(error: unknown): never {
	if (error instanceof ProjectNotFoundError) {
		throw new HTTPException(404, { message: error.message });
	}
	if (error instanceof TaskModelValidationError) {
		throw new HTTPException(400, { message: error.message });
	}
	if (error instanceof TaskOptimisticLockError) {
		throw new HTTPException(409, { message: error.message });
	}
	throw error;
}

function requireProjectId(c: Context): string {
	const projectId = c.req.query('projectId')?.trim();
	if (!projectId) {
		throw new HTTPException(400, { message: 'projectId クエリは必須です。' });
	}
	return projectId;
}

export async function listTasksController(c: Context) {
	const projectId = requireProjectId(c);

	try {
		const tasks = await listTasksUseCase(projectId);
		return c.json(tasks.map(toApiTask));
	} catch (error) {
		handleTaskValidationError(error);
	}
}

export async function createTaskController(c: Context) {
	const projectId = requireProjectId(c);
	const payload = createTaskSchema.parse(await readJson(c.req.raw));

	try {
		const created = await createTaskUseCase(projectId, payload);
		return c.json(toApiTask(created), 201);
	} catch (error) {
		handleTaskValidationError(error);
	}
}

export async function listTaskHistoryController(c: Context) {
	const projectId = requireProjectId(c);
	const taskId = c.req.param('id');

	try {
		const history = await listTaskHistoryUseCase(projectId, taskId);
		return c.json(history.map(toApiTaskHistory));
	} catch (error) {
		handleTaskValidationError(error);
	}
}

export async function updateTaskController(c: Context) {
	const projectId = requireProjectId(c);
	const taskId = c.req.param('id');
	const payload = updateTaskSchema.parse(await readJson(c.req.raw));

	try {
		const updated = await updateTaskUseCase(projectId, taskId, payload);

		if (!updated) {
			throw new HTTPException(404, { message: 'task not found' });
		}

		return c.json(toApiTask(updated));
	} catch (error) {
		handleTaskValidationError(error);
	}
}

export async function deleteTaskController(c: Context) {
	const projectId = requireProjectId(c);
	const taskId = c.req.param('id');

	try {
		const deleted = await deleteTaskUseCase(projectId, taskId);

		if (!deleted) {
			throw new HTTPException(404, { message: 'task not found' });
		}

		return c.body(null, 204);
	} catch (error) {
		handleTaskValidationError(error);
	}
}

export async function reorderTasksController(c: Context) {
	const projectId = requireProjectId(c);
	const payload = reorderTasksSchema.parse(await readJson(c.req.raw));

	try {
		const reordered = await reorderTasksUseCase(projectId, payload.ids);
		return c.json(reordered.map(toApiTask));
	} catch (error) {
		handleTaskValidationError(error);
	}
}
