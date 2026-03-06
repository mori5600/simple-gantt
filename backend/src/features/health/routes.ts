import { Hono } from 'hono';
import { healthController } from './controller';

export function createHealthRoutes(): Hono {
	const app = new Hono();

	app.get('/', healthController);

	return app;
}
