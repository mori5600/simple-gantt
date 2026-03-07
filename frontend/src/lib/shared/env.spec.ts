import { describe, expect, it } from 'vitest';
import { normalizeClientEnvValue, readClientEnv } from './env';

describe('env helpers', () => {
	it('readClientEnv should return the first matching runtime string value', () => {
		expect(readClientEnv('MISSING_ENV_KEY', 'MODE', 'BASE_URL')).toBeTypeOf('string');
	});

	it('normalizeClientEnvValue should trim quotes and optionally lowercase values', () => {
		expect(normalizeClientEnvValue(' "HTTP://LOCALHOST:8787/" ')).toBe('HTTP://LOCALHOST:8787/');
		expect(normalizeClientEnvValue(" 'API' ", { lowerCase: true })).toBe('api');
		expect(normalizeClientEnvValue(undefined)).toBe('');
	});
});
