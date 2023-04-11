import benchmark from 'benchmark';
import DataLoader from 'dataloader';
import * as dldr from 'dldr';
import * as dldrCache from 'dldr/cache';

const loadFn = async (keys) => Promise.resolve(keys);

const contenders = {
	dldr: () => {
		return (key) => dldr.load(loadFn, key);
	},
	'dldr/cache': () => {
		const cache = new Map();
		return (key) => dldrCache.load(loadFn, cache, key);
	},
	dataloader: () => {
		const loader = new DataLoader(loadFn, {
			cache: false,
		});

		return (key) => loader.load(key);
	},
	'dataloader/cache': () => {
		const loader = new DataLoader(loadFn, {
			cache: true,
		});

		return (key) => loader.load(key);
	},
};

async function runner(contenders) {
	const keys = ['a', 'b', 'c', 'a'];

	console.log('\nValidation');
	for (const [name, contender] of Object.entries(contenders)) {
		try {
			const lib = contender();
			const results = await Promise.all(keys.map((v) => lib(v)));
			const isSame = results.every((result, i) => result === keys[i]);
			if (!isSame) {
				throw new Error(
					`expected to return values in the same order as the input`,
				);
			}
			console.log('  ✔', name);
		} catch (err) {
			console.log('  ✘', name, `(FAILED @ "${err.message}")`);
		}
	}

	console.log('\nBenchmark');
	const bench = new benchmark.Suite().on('cycle', (e) => {
		console.log('  ' + e.target);
	});

	for (const [name, contender] of Object.entries(contenders)) {
		var lib = contender();
		bench.add(name, {
			defer: true,
			fn: function (deferred) {
				Promise.all(keys.map((v) => lib(v))).then((v) => {
					deferred.resolve();
				});
			},
		});
	}

	return new Promise((resolve) => {
		bench.on('complete', resolve);
		bench.run({ async: false, queued: true });
	});
}

await runner(contenders);
