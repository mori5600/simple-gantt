import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerMock } = vi.hoisted(() => ({
	loggerMock: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn()
	}
}));

vi.mock('./platform/logger', () => ({
	logger: loggerMock
}));

import { createApp } from './app';

describe('app', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.CORS_ORIGIN;
	});

	it('GET /api/health should return ok payload', async () => {
		const response = await createApp().request('/api/health');

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ status: 'ok' });
		expect(loggerMock.info).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				path: '/api/health',
				status: 200,
				durationMs: expect.any(Number)
			}),
			'HTTP request completed'
		);
	});

	it('should return configured fallback origin when request origin is not allowed', async () => {
		process.env.CORS_ORIGIN = 'https://allowed.example,https://fallback.example';

		const response = await createApp().request('http://localhost/api/health', {
			headers: {
				Origin: 'https://evil.example'
			}
		});

		expect(response.headers.get('access-control-allow-origin')).toBe('https://allowed.example');
	});

	it('should fall back to wildcard when configured origins are empty and request has no origin', async () => {
		process.env.CORS_ORIGIN = '';

		const response = await createApp().request('http://localhost/api/health');

		expect(response.headers.get('access-control-allow-origin')).toBe('*');
	});

	it('should fall back to wildcard when configured origins are empty and request origin is denied', async () => {
		process.env.CORS_ORIGIN = '';

		const response = await createApp().request('http://localhost/api/health', {
			headers: {
				Origin: 'https://evil.example'
			}
		});

		expect(response.headers.get('access-control-allow-origin')).toBe('*');
	});

	it('should echo request origin when wildcard is configured', async () => {
		process.env.CORS_ORIGIN = '*';

		const response = await createApp().request('http://localhost/api/health', {
			headers: {
				Origin: 'https://evil.example'
			}
		});

		expect(response.headers.get('access-control-allow-origin')).toBe('https://evil.example');
	});

	it('should return 404 for unknown routes', async () => {
		const response = await createApp().request('/missing');

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'Not Found' });
	});

	it('should convert HTTPException to JSON error response', async () => {
		const app = createApp();
		app.get('/api/http-error', () => {
			throw new HTTPException(418, { message: 'teapot' });
		});

		const response = await app.request('/api/http-error');

		expect(response.status).toBe(418);
		await expect(response.json()).resolves.toEqual({ error: 'teapot' });
		expect(loggerMock.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				path: '/api/http-error',
				status: 418,
				message: 'teapot'
			}),
			'HTTP exception'
		);
	});

	it('should convert ZodError to validation response', async () => {
		const app = createApp();
		app.get('/api/zod-error', () => {
			return z
				.object({
					name: z.string().min(2)
				})
				.parse({
					name: ''
				});
		});

		const response = await app.request('/api/zod-error');

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'Validation Error',
			details: [
				{
					path: 'name',
					message: expect.any(String)
				}
			]
		});
		expect(loggerMock.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				path: '/api/zod-error',
				issues: expect.any(Array)
			}),
			'Validation error'
		);
	});

	it('should convert unexpected errors to 500 responses', async () => {
		const app = createApp();
		app.get('/api/boom', () => {
			throw new Error('boom');
		});

		const response = await app.request('/api/boom');

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: 'Internal Server Error' });
		expect(loggerMock.error).toHaveBeenCalledWith(
			expect.objectContaining({
				path: '/api/boom',
				err: expect.any(Error)
			}),
			'Unhandled application error'
		);
	});
});
