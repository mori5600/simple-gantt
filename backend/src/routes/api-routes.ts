import type { Hono } from 'hono';
import { healthController } from '../controllers/health-controller';
import {
	createProjectController,
	deleteProjectController,
	listProjectsController,
	listProjectSummariesController,
	reorderProjectsController,
	updateProjectController
} from '../controllers/project-controller';
import {
	createTaskController,
	deleteTaskController,
	listTasksController,
	reorderTasksController,
	updateTaskController
} from '../controllers/task-controller';
import {
	createUserController,
	deleteUserController,
	listUsersController,
	listUserSummariesController,
	updateUserController
} from '../controllers/user-controller';

export function registerApiRoutes(app: Hono): void {
	app.get('/api/health', healthController);
	app.get('/api/projects', listProjectsController);
	app.get('/api/projects/summary', listProjectSummariesController);
	app.post('/api/projects', createProjectController);
	app.patch('/api/projects/:id', updateProjectController);
	app.delete('/api/projects/:id', deleteProjectController);
	app.post('/api/projects/reorder', reorderProjectsController);
	app.get('/api/users', listUsersController);
	app.get('/api/users/summary', listUserSummariesController);
	app.post('/api/users', createUserController);
	app.patch('/api/users/:id', updateUserController);
	app.delete('/api/users/:id', deleteUserController);
	app.get('/api/tasks', listTasksController);
	app.post('/api/tasks', createTaskController);
	app.patch('/api/tasks/:id', updateTaskController);
	app.delete('/api/tasks/:id', deleteTaskController);
	app.post('/api/tasks/reorder', reorderTasksController);
}
