import DataLoader from 'npm:dataloader';

import type { LoadFn } from './mod.ts';
import * as dldr from './cache.ts';

const loadFn: LoadFn<any, string> = async (keys: string[]) => Promise.resolve(keys);
const keys = ['a', 'b', 'c', 'a'];

Deno.bench({
	name: 'dldr',
	baseline: true,
	async fn() {
		let _ = await Promise.all(keys.map((key) => dldr.load(loadFn, undefined, key)));
	},
});

Deno.bench({
	name: 'dataloader',
	async fn() {
		const loader = new DataLoader(loadFn as any, { cache: true });
		let _ = await loader.loadMany(keys);
	},
});
