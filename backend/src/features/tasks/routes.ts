import { Hono } from 'hono';
import {
	createTaskController,
	deleteTaskController,
	listTaskHistoryController,
	listTasksController,
	reorderTasksController,
	updateTaskController
} from './controller';

export function createTaskRoutes(): Hono {
	const app = new Hono();

	app.get('/', listTasksController);
	app.get('/:id/history', listTaskHistoryController);
	app.post('/', createTaskController);
	app.patch('/:id', updateTaskController);
	app.delete('/:id', deleteTaskController);
	app.post('/reorder', reorderTasksController);

	return app;
}
