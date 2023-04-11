import { EMPTY, suite } from '@thi.ng/bench';
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

	const cases = [];
	for (const [name, contender] of Object.entries(contenders)) {
		{
			const run = contender();
			const results = await Promise.all(keys.map(run));
			console.assert(results.every((result, i) => result === keys[i]));
		}

		const run = contender();
		const fn = async () => Promise.all(keys.map(run));
		cases.push({ fn, title: name });
	}

	suite(cases, {
		warmup: 300,
		size: 50,
		iter: 10_000,
		format: FORMAT(),
	});
}

const FORMAT = () => {
	const formatter = new Intl.NumberFormat('en-US');
	return {
		prefix: EMPTY,
		suffix: EMPTY,
		start: EMPTY,
		warmup: EMPTY,
		result: EMPTY,
		total(a) {
			const winner = a.slice().sort((a, b) => a.mean - b.mean)[0];
			const compute = a.map((x) => {
				return {
					title: x.title,
					won: x === winner,
					ops: formatter.format(
						Math.floor((x.iter * x.size) / (x.total / 1000)),
					),
					sd: (x.sd / 1000).toFixed(2),
				};
			});
			const max_name = Math.max(...a.map((x) => x.title.length));
			const max_ops = Math.max(...compute.map((x) => x.ops.length));
			const lines = [];
			for (const x of compute) {
				const won = x.won ? '★ ' : '  ';
				lines.push(
					`${won}${x.title.padEnd(max_name)} ~ ${x.ops.padStart(
						max_ops,
					)} ops/sec ± ${x.sd}%`,
				);
			}
			return lines.join('\n');
		},
	};
};

await runner(contenders);
