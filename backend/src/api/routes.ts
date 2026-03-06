import { Hono } from 'hono';
import { createHealthRoutes } from '../features/health/routes';
import { createProjectRoutes } from '../features/projects/routes';
import { createTaskRoutes } from '../features/tasks/routes';
import { createUserRoutes } from '../features/users/routes';

export function createApiRoutes(): Hono {
	const api = new Hono();

	api.route('/health', createHealthRoutes());
	api.route('/projects', createProjectRoutes());
	api.route('/users', createUserRoutes());
	api.route('/tasks', createTaskRoutes());

	return api;
}
