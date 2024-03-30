import { suite } from 'npm:@marais/bench';
import DataLoader from 'npm:dataloader';
import * as dldr from '../mod.ts';
import * as dldrCache from '../cache/mod.ts';

const loadFn: dldr.LoadFn<any, string> = async (keys: string[]) => Promise.resolve(keys);

await suite<any[]>(
	{
		dldr: () => {
			return (keys) => Promise.all(keys.map((key) => dldr.load(loadFn, key)));
		},
		'dldr/cache': () => {
			const cache = new Map();
			return (keys) =>
				Promise.all(
					keys.map((key) => dldrCache.load(loadFn, cache, key)),
				);
		},
		dataloader: () => {
			const loader = new DataLoader(loadFn as any, {
				cache: false,
			});

			return (keys) => loader.loadMany(keys);
		},
		'dataloader/cache': () => {
			const loader = new DataLoader(loadFn as any, {
				cache: true,
			});

			return (keys) => loader.loadMany(keys);
		},
	},
	(run) => {
		const keys = ['a', 'b', 'c', 'a'];
		run(
			undefined,
			() => keys,
			(results) => results.every((result, i) => result === keys[i]),
		);
	},
);
