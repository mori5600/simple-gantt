/**
 * @fileoverview
 * TypeScript(`tsc`)で出力した ESM の相対 import を後処理し、
 * 拡張子がない specifier に `.js` を補完するスクリプト。
 *
 * 例: `from './foo'` -> `from './foo.js'`
 *
 * Node.js の ESM 実行時に拡張子解決で失敗しないようにするために使う。
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const targetDir = process.argv[2];

if (!targetDir) {
	console.error(
		'Usage: node scripts/fix-relative-imports.mjs <dist-dir>\n例: node scripts/fix-relative-imports.mjs dist'
	);
	process.exit(1);
}

/** @type {string[]} */
const filePaths = [];

/**
 * 指定ディレクトリ配下を再帰的に走査し、`.js` ファイルを収集する。
 *
 * @param {string} dirPath
 * @returns {Promise<void>}
 */
async function walk(dirPath) {
	const entries = await readdir(dirPath, { withFileTypes: true });
	for (const entry of entries) {
		const entryPath = join(dirPath, entry.name);
		if (entry.isDirectory()) {
			await walk(entryPath);
			continue;
		}
		if (entry.isFile() && entry.name.endsWith('.js')) {
			filePaths.push(entryPath);
		}
	}
}

/**
 * 相対 import specifier に拡張子がない場合のみ `.js` を付与する。
 * `?raw` のようなクエリ文字列は維持する。
 *
 * @param {string} specifier
 * @returns {string}
 */
function appendJsExtension(specifier) {
	const [pathWithoutQuery, query = ''] = specifier.split('?');
	const extension = extname(pathWithoutQuery);
	if (extension) {
		return specifier;
	}
	const withExtension = `${pathWithoutQuery}.js`;
	return query ? `${withExtension}?${query}` : withExtension;
}

/**
 * ファイル内容内の相対 `import` / `from` specifier を `.js` 付きへ書き換える。
 * 以下は対象外:
 * - `export ... from './x'` のような export 文
 * - `import.meta` など import 文でない構文
 * - コメント文字列中の擬似 import
 *
 * @param {string} content
 * @returns {string}
 */
function rewriteImports(content) {
	return content.replace(
		/(from\s+|import\s+|import\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)(['"])/g,
		(match, prefix, quote, specifier, endQuote) => {
			if (quote !== endQuote) {
				return match;
			}
			return `${prefix}${quote}${appendJsExtension(specifier)}${endQuote}`;
		}
	);
}

const distPath = resolve(process.cwd(), targetDir);
await walk(distPath);

for (const filePath of filePaths) {
	const original = await readFile(filePath, 'utf8');
	const rewritten = rewriteImports(original);
	if (rewritten !== original) {
		await writeFile(filePath, rewritten, 'utf8');
	}
}
