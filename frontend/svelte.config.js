/**
 * 開発環境の依存差分で adapter-static が未解決でも起動できるよう、
 * static を優先しつつ node へフォールバックする。
 */
async function loadAdapter() {
	try {
		const mod = await import('@sveltejs/adapter-static');
		return {
			kind: 'static',
			create: mod.default
		};
	} catch (error) {
		const maybeCode = error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined;
		if (maybeCode !== 'ERR_MODULE_NOT_FOUND') {
			throw error;
		}
		const mod = await import('@sveltejs/adapter-node');
		return {
			kind: 'node',
			create: mod.default
		};
	}
}

const loadedAdapter = await loadAdapter();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter:
			loadedAdapter.kind === 'static'
				? loadedAdapter.create({
						fallback: '200.html'
					})
				: loadedAdapter.create()
	}
};

export default config;
