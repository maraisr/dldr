// deno-lint-ignore-file no-import-prefix

// Credit @lukeed https://github.com/lukeed/empathic/blob/main/scripts/build.ts

// Publish:
//   -> edit package.json version
//   -> edit deno.json version
//   $ git commit "release: x.x.x"
//   $ git tag "vx.x.x"
//   $ git push origin main --tags
//   #-> CI builds w/ publish

import { transform } from 'npm:oxc-transform@0.137.0';
import { minify } from 'npm:oxc-minify@0.137.0';
import { dirname, join, relative, resolve } from '@std/path';

import denoJson from '../deno.json' with { type: 'json' };

const root = resolve('.');
const output = resolve('npm');

const Encoder = new TextEncoder();

if (exists(output)) {
	await Deno.remove(output, { recursive: true });
}

let Inputs;
if (typeof denoJson.exports === 'string') Inputs = { '.': denoJson.exports };
else Inputs = denoJson.exports;

async function write(file: string, raw: string, compress?: boolean) {
	let dir = dirname(file);
	await Deno.mkdir(dir, {
		recursive: true,
	});

	await Deno.writeTextFile(file, raw);

	let gz: number;
	file = relative(root, file);
	console.log('> writing "%s" file', file);

	if (compress) {
		let c = await minify(file, raw, { compress: true, mangle: true });
		gz = await gzip(Encoder.encode(c.code));
	} else {
		gz = await gzip(Encoder.encode(raw));
	}

	console.log('::notice::%s (%d B)', file, gz);
}

async function compile(name: string, src: string) {
	let raw = await Deno.readTextFile(src);
	if (name === '.') name = 'index';
	name = name.replace(/^\.\//, '');

	let file: string;
	let xform = await transform(src, raw, {
		target: 'esnext',
		sourceType: 'module',
		typescript: {
			rewriteImportExtensions: 'rewrite',
			declaration: {
				sourcemap: false,
				stripInternal: true,
			},
		},
	});

	if (xform.errors.length > 0) bail('transform', xform.errors.map((err: any) => err.message));

	file = `${output}/${name}.js`;
	await write(file, xform.code, true);

	if (xform.declaration) {
		file = `${output}/${name}.d.ts`;
		await write(file, xform.declaration);
	}
}

for (let [name, src] of Object.entries(Inputs)) await compile(name, src);

await copy('package.json');
await copy('readme.md');
await copy('license');

// ---

function bail(label: string, errors: string[]) {
	console.error('[%s] error(s)\n', label, errors.join(''));
	Deno.exit(1);
}

function exists(path: string) {
	try {
		Deno.statSync(path);
		return true;
	} catch (_) {
		return false;
	}
}

function copy(file: string) {
	if (exists(file)) {
		let outfile = join(output, file);
		console.log('> writing "%s" file', relative(root, outfile));
		return Deno.copyFile(file, outfile);
	}
}

async function gzip(input: Uint8Array) {
	let size = 0;
	let stream = new ReadableStream({
		start(ctrl) {
			ctrl.enqueue(input);
			ctrl.close();
		},
	}).pipeThrough(new CompressionStream('gzip'));

	let reader = stream.getReader();

	while (true) {
		let tmp = await reader.read();
		if (tmp.value) size += tmp.value.length;
		if (tmp.done) return size;
	}
}
