const path = require('node:path');

/** @type {import('prettier').Config} */
module.exports = {
	useTabs: true,
	singleQuote: true,
	trailingComma: 'none',
	printWidth: 100,
	overrides: [
		{
			files: 'frontend/**/*.{svelte,css,js,ts}',
			options: {
				plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],
				tailwindStylesheet: path.join(__dirname, 'frontend/src/routes/layout.css')
			}
		},
		{
			files: 'frontend/**/*.svelte',
			options: {
				parser: 'svelte'
			}
		}
	]
};
