import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { readJson } from '../lib/http';
import {
	createProjectUseCase,
	deleteProjectUseCase,
	listProjectsUseCase,
	listProjectSummariesUseCase,
	ProjectModelValidationError,
	ProjectOptimisticLockError,
	reorderProjectsUseCase,
	updateProjectUseCase
} from '../usecases/project-usecases';
import {
	createProjectSchema,
	reorderProjectsSchema,
	updateProjectSchema
} from '../schemas/project-schemas';
import { toApiProject, toApiProjectSummary } from '../serializers/serializers';

function handleProjectValidationError(error: unknown): never {
	if (error instanceof ProjectModelValidationError) {
		throw new HTTPException(400, { message: error.message });
	}
	if (error instanceof ProjectOptimisticLockError) {
		throw new HTTPException(409, { message: error.message });
	}
	throw error;
}

export async function listProjectsController(c: Context) {
	try {
		const projects = await listProjectsUseCase();
		return c.json(projects.map(toApiProject));
	} catch (error) {
		handleProjectValidationError(error);
	}
}

export async function listProjectSummariesController(c: Context) {
	try {
		const projects = await listProjectSummariesUseCase();
		return c.json(projects.map(toApiProjectSummary));
	} catch (error) {
		handleProjectValidationError(error);
	}
}

export async function createProjectController(c: Context) {
	const payload = createProjectSchema.parse(await readJson(c.req.raw));

	try {
		const created = await createProjectUseCase(payload);
		return c.json(toApiProject(created), 201);
	} catch (error) {
		handleProjectValidationError(error);
	}
}

export async function updateProjectController(c: Context) {
	const projectId = c.req.param('id');
	const payload = updateProjectSchema.parse(await readJson(c.req.raw));

	try {
		const updated = await updateProjectUseCase(projectId, payload);
		if (!updated) {
			throw new HTTPException(404, { message: 'project not found' });
		}
		return c.json(toApiProject(updated));
	} catch (error) {
		handleProjectValidationError(error);
	}
}

export async function deleteProjectController(c: Context) {
	const projectId = c.req.param('id');

	try {
		const deleted = await deleteProjectUseCase(projectId);
		if (!deleted) {
			throw new HTTPException(404, { message: 'project not found' });
		}
		return c.body(null, 204);
	} catch (error) {
		handleProjectValidationError(error);
	}
}

export async function reorderProjectsController(c: Context) {
	const payload = reorderProjectsSchema.parse(await readJson(c.req.raw));

	try {
		const reordered = await reorderProjectsUseCase(payload.ids);
		return c.json(reordered.map(toApiProject));
	} catch (error) {
		handleProjectValidationError(error);
	}
}
