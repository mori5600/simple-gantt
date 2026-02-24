import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readText(url: URL): string {
	return readFileSync(url, 'utf8');
}

describe('adapter-static configuration', () => {
	it('should use 200.html as fallback page in svelte.config.js', () => {
		const configSource = readText(new URL('../../svelte.config.js', import.meta.url));

		expect(configSource).toMatch(/fallback:\s*['"]200\.html['"]/);
		expect(configSource).not.toMatch(/fallback:\s*['"]index\.html['"]/);
		expect(configSource).not.toMatch(/strict:\s*false/);
	});

	it('should route unmatched paths to 200.html in nginx static config', () => {
		const nginxSource = readText(
			new URL('../../../docker/nginx/frontend-static.conf', import.meta.url)
		);

		expect(nginxSource).toMatch(/try_files\s+\$uri\s+\$uri\/\s+\/200\.html;/);
		expect(nginxSource).not.toMatch(/try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/);
	});
});
