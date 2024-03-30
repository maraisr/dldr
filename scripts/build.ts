import { build, emptyDir } from '@deno/dnt';

await emptyDir('./npm');

await build({
	entryPoints: ['./mod.ts'],
	outDir: './npm',
	shims: {
		deno: 'dev',
	},

	declaration: 'inline',
	declarationMap: false,
	scriptModule: 'cjs',
	typeCheck: 'both',
	test: true,

	importMap: 'deno.json',

	/*	mappings: {
		'jsr:@mr/object-identity': {
			name: 'object-identity',
			version: '^0.1.2',
		},
	},*/

	package: {
		name: 'dldr',
		version: Deno.args[0],
		description: 'A tiny (367B) utility for batching and caching operations',
		repository: 'maraisr/dldr',
		license: 'MIT',
		author: {
			name: 'Marais Rososuw',
			email: 'me@marais.dev',
			url: 'https://marais.io',
		},
		keywords: [
			'dataloader',
			'batch',
			'batch',
			'graphql',
			'utility',
		],
	},

	compilerOptions: {
		target: 'ES2022',
		lib: ['ES2022', 'WebWorker'],
	},

	filterDiagnostic(diag) {
		let txt = diag.messageText.toString();
		return !txt.includes(
			// ignore type error for missing Deno built-in information
			`Type 'ReadableStream<string>' must have a '[Symbol.asyncIterator]()' method that returns an async iterator`,
		);
	},

	async postBuild() {
		await Deno.copyFile('license', 'npm/license');
		await Deno.copyFile('readme.md', 'npm/readme.md');
	},
});
