import { describe, expect, it } from 'vitest';
import { HTTPException } from 'hono/http-exception';
import { parseOrigins, readJson, resolveCorsOrigins } from './http';

describe('http utils', () => {
	it('parseOrigins should trim values and remove empty entries', () => {
		const actual = parseOrigins(' http://localhost:5173 , ,https://example.com  ,');

		expect(actual).toEqual(['http://localhost:5173', 'https://example.com']);
	});

	it('resolveCorsOrigins should return default local origins when value is undefined', () => {
		expect(resolveCorsOrigins()).toEqual([
			'http://localhost:3000',
			'http://127.0.0.1:3000',
			'http://localhost:4173',
			'http://127.0.0.1:4173',
			'http://localhost:5173',
			'http://127.0.0.1:5173'
		]);
	});

	it('resolveCorsOrigins should prioritize configured value when provided', () => {
		const actual = resolveCorsOrigins('http://localhost:3000, http://example.com');

		expect(actual).toEqual(['http://localhost:3000', 'http://example.com']);
	});

	it('readJson should parse valid JSON body', async () => {
		const request = new Request('http://localhost/api/tasks', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ title: 'task' })
		});

		const payload = await readJson<{ title: string }>(request);
		expect(payload.title).toBe('task');
	});

	it('readJson should throw HTTPException(400) for invalid JSON', async () => {
		const request = new Request('http://localhost/api/tasks', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: '{invalid'
		});

		await expect(readJson(request)).rejects.toSatisfy(
			(error: unknown) => error instanceof HTTPException && error.status === 400
		);
	});
});
