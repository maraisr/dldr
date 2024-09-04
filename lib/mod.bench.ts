import DataLoader from 'npm:dataloader';

import * as dldr from './mod.ts';

const loadFn: dldr.LoadFn<any, string> = async (keys: string[]) => Promise.resolve(keys);
const keys = ['a', 'b', 'c', 'a'];

Deno.bench({
	name: 'dldr',
	baseline: true,
	async fn() {
		let _ = await Promise.all(keys.map((key) => dldr.load(loadFn, key)));
	},
});

Deno.bench({
	name: 'dataloader',
	async fn() {
		const loader = new DataLoader(loadFn as any, { cache: false });
		let _ = await loader.loadMany(keys);
	},
});
