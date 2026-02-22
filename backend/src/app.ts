import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { resolveCorsOrigins } from './lib/http';
import { logger } from './lib/logger';
import { registerApiRoutes } from './routes/api-routes';

function requestLogContext(c: Context): { method: string; path: string } {
	return {
		method: c.req.method,
		path: c.req.path
	};
}

export function createApp(): Hono {
	const app = new Hono();
	const origins = resolveCorsOrigins(process.env.CORS_ORIGIN);

	app.use('*', async (c, next) => {
		const startedAt = performance.now();
		await next();
		const durationMs = Number((performance.now() - startedAt).toFixed(1));

		logger.info(
			{
				...requestLogContext(c),
				status: c.res.status,
				durationMs
			},
			'HTTP request completed'
		);
	});

	app.use(
		'/api/*',
		cors({
			origin: (origin) => {
				if (!origin) {
					return origins[0] ?? '*';
				}
				if (origins.includes('*') || origins.includes(origin)) {
					return origin;
				}
				return origins[0] ?? '*';
			},
			allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
			allowHeaders: ['Content-Type']
		})
	);

	registerApiRoutes(app);

	app.notFound((c) => c.json({ error: 'Not Found' }, 404));

	app.onError((error, c) => {
		const requestContext = requestLogContext(c);

		if (error instanceof HTTPException) {
			logger.warn(
				{
					...requestContext,
					status: error.status,
					message: error.message
				},
				'HTTP exception'
			);
			return c.json({ error: error.message }, error.status);
		}
		if (error instanceof ZodError) {
			logger.warn(
				{
					...requestContext,
					issues: error.issues
				},
				'Validation error'
			);
			return c.json(
				{
					error: 'Validation Error',
					details: error.issues.map((issue) => ({
						path: issue.path.join('.'),
						message: issue.message
					}))
				},
				400
			);
		}

		logger.error(
			{
				...requestContext,
				err: error
			},
			'Unhandled application error'
		);
		return c.json({ error: 'Internal Server Error' }, 500);
	});

	return app;
}
