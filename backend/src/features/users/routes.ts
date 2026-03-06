import { Hono } from 'hono';
import {
	createUserController,
	deleteUserController,
	listUsersController,
	listUserSummariesController,
	updateUserController
} from './controller';

export function createUserRoutes(): Hono {
	const app = new Hono();

	app.get('/', listUsersController);
	app.get('/summary', listUserSummariesController);
	app.post('/', createUserController);
	app.patch('/:id', updateUserController);
	app.delete('/:id', deleteUserController);

	return app;
}
