// Credit @lukeed https://github.com/lukeed/empathic/blob/main/scripts/build.ts

// Publish:
//   -> edit package.json version
//   -> edit deno.json version
//   $ git commit "release: x.x.x"
//   $ git tag "vx.x.x"
//   $ git push origin main --tags
//   #-> CI builds w/ publish

import oxc from 'npm:oxc-transform@^0.30';
import { join, resolve } from '@std/path';

import denoJson from '../deno.json' with { type: 'json' };

const outdir = resolve('npm');

let Inputs;
if (typeof denoJson.exports === 'string') Inputs = { '.': denoJson.exports };
else Inputs = denoJson.exports;

async function transform(name: string, filename: string) {
	if (name === '.') name = 'index';
	name = name.replace(/^\.\//, '');

	let entry = resolve(filename);
	let source = await Deno.readTextFile(entry);

	let xform = oxc.transform(entry, source, {
		typescript: {
			onlyRemoveTypeImports: true,
			declaration: {
				stripInternal: true,
			},
		},
	});

	if (xform.errors.length > 0) bail('transform', xform.errors);

	let outfile = `${outdir}/${name}.d.mts`;
	console.log('> writing "%s" file', outfile);
	await Deno.writeTextFile(outfile, xform.declaration!);

	outfile = `${outdir}/${name}.mjs`;
	console.log('> writing "%s" file', outfile);
	await Deno.writeTextFile(outfile, xform.code);
}

console.log('! cleaning "npm" directory');
await new Deno.Command('git', {
	args: ['clean', '-xfd', outdir],
	stderr: 'inherit',
}).output();

for (let [name, filename] of Object.entries(Inputs)) await transform(name, filename);

await copy('readme.md');
await copy('license');

// ---

function bail(label: string, errors: string[]): never {
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
		let outfile = join(outdir, file);
		console.log('> writing "%s" file', outfile);
		return Deno.copyFile(file, outfile);
	}
}
