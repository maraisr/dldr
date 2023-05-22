import { suite } from '@marais/bench';
import DataLoader from 'dataloader';
import * as dldr from 'dldr';
import * as dldrCache from 'dldr/cache';

const loadFn = async (keys) => Promise.resolve(keys);

const contenders = {
	dldr: () => {
		return (keys) => Promise.all(keys.map((key) => dldr.load(loadFn, key)));
	},
	'dldr/cache': () => {
		const cache = new Map();
		return (keys) => Promise.all(keys.map((key) => dldrCache.load(loadFn, cache, key)));
	},
	dataloader: () => {
		const loader = new DataLoader(loadFn, {
			cache: false,
		});

		return (keys) => loader.loadMany(keys);
	},
	'dataloader/cache': () => {
		const loader = new DataLoader(loadFn, {
			cache: true,
		});

		return (keys) => loader.loadMany(keys);
	},
};

await suite(contenders, (run) => {
	const keys = ['a', 'b', 'c', 'a'];
	run(
		null,
		() => keys,
		(results) => results.every((result, i) => result === keys[i]),
	);
});
