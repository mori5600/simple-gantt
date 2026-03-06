import { HTTPException } from 'hono/http-exception';

const defaultCorsOrigins = [
	'http://localhost:3000',
	'http://127.0.0.1:3000',
	'http://localhost:4173',
	'http://127.0.0.1:4173',
	'http://localhost:5173',
	'http://127.0.0.1:5173'
];

export function parseOrigins(value: string): string[] {
	return value
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

export function resolveCorsOrigins(value?: string): string[] {
	return parseOrigins(value ?? defaultCorsOrigins.join(','));
}

export async function readJson<T>(request: Request): Promise<T> {
	try {
		return (await request.json()) as T;
	} catch {
		throw new HTTPException(400, { message: 'JSON ボディの形式が不正です。' });
	}
}
