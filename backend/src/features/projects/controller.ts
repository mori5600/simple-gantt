import { HTTP_STATUS } from '@simple-gantt/shared/http-status';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { toApiProject, toApiProjectSummary, toApiUser } from '../../api/serializers';
import { readJson } from '../../http/utils';
import {
	createProjectUseCase,
	deleteProjectUseCase,
	listProjectMembersUseCase,
	listProjectsUseCase,
	listProjectSummariesUseCase,
	ProjectModelValidationError,
	ProjectOptimisticLockError,
	reorderProjectsUseCase,
	setProjectMembersUseCase,
	updateProjectUseCase
} from './usecases';
import {
	createProjectSchema,
	reorderProjectsSchema,
	setProjectMembersSchema,
	updateProjectSchema
} from './schemas';

function handleProjectValidationError(error: unknown): never {
	if (error instanceof ProjectModelValidationError) {
		throw new HTTPException(HTTP_STATUS.BAD_REQUEST, { message: error.message });
	}
	if (error instanceof ProjectOptimisticLockError) {
		throw new HTTPException(HTTP_STATUS.CONFLICT, { message: error.message });
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
		return c.json(toApiProject(created), HTTP_STATUS.CREATED);
	} catch (error) {
		handleProjectValidationError(error);
	}
}

export async function listProjectMembersController(c: Context) {
	const projectId = c.req.param('id');

	try {
		const members = await listProjectMembersUseCase(projectId);
		if (!members) {
			throw new HTTPException(HTTP_STATUS.NOT_FOUND, { message: 'project not found' });
		}
		return c.json(members.map(toApiUser));
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
			throw new HTTPException(HTTP_STATUS.NOT_FOUND, { message: 'project not found' });
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
			throw new HTTPException(HTTP_STATUS.NOT_FOUND, { message: 'project not found' });
		}
		return c.body(null, HTTP_STATUS.NO_CONTENT);
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

export async function setProjectMembersController(c: Context) {
	const projectId = c.req.param('id');
	const payload = setProjectMembersSchema.parse(await readJson(c.req.raw));

	try {
		const members = await setProjectMembersUseCase(projectId, payload);
		if (!members) {
			throw new HTTPException(HTTP_STATUS.NOT_FOUND, { message: 'project not found' });
		}
		return c.json(members.map(toApiUser));
	} catch (error) {
		handleProjectValidationError(error);
	}
}
