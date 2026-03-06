import { Hono } from 'hono';
import {
	createProjectController,
	deleteProjectController,
	listProjectMembersController,
	listProjectsController,
	listProjectSummariesController,
	reorderProjectsController,
	setProjectMembersController,
	updateProjectController
} from './controller';

export function createProjectRoutes(): Hono {
	const app = new Hono();

	app.get('/', listProjectsController);
	app.get('/summary', listProjectSummariesController);
	app.post('/', createProjectController);
	app.patch('/:id', updateProjectController);
	app.delete('/:id', deleteProjectController);
	app.post('/reorder', reorderProjectsController);
	app.get('/:id/members', listProjectMembersController);
	app.put('/:id/members', setProjectMembersController);

	return app;
}
