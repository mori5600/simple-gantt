import type { Context } from 'hono';

export function healthController(c: Context) {
	return c.json({
		status: 'ok'
	});
}
