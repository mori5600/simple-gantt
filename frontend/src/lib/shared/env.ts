type RuntimeEnv = Record<string, unknown>;

export function readClientEnv(...keys: string[]): string | undefined {
	const env = (import.meta as ImportMeta & { env?: RuntimeEnv }).env;
	if (!env) {
		return undefined;
	}
	for (const key of keys) {
		const value = env[key];
		if (typeof value === 'string') {
			return value;
		}
	}
	return undefined;
}

export function normalizeClientEnvValue(
	value: string | undefined,
	options: { lowerCase?: boolean } = {}
): string {
	const normalized = (value ?? '').trim().replace(/^['"]|['"]$/g, '');
	if (!options.lowerCase) {
		return normalized;
	}
	return normalized.toLowerCase();
}
