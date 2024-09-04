import { assert, assertEquals, assertInstanceOf } from '@std/assert';
import { spy } from 'npm:nanospy';
import { setImmediate } from 'node:timers/promises';

import * as dldr from './cache.ts';

Deno.test('api', () => {
	assertInstanceOf(dldr.load, Function);
	assertInstanceOf(dldr.factory, Function);
});

Deno.test('should work with default cache', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	// note for tests, we do pollute the global cache

	const items = await Promise.all([
		dldr.load(loader, undefined, 'a'),
		dldr.load(loader, undefined, 'b'),
		dldr.load(loader, undefined, 'c'),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(items[0], 'a');
	assertEquals(items[1], 'b');
	assertEquals(items[2], 'c');
});

Deno.test('should work for passed tests', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	const cache = new Map();

	const items = await Promise.all([
		dldr.load(loader, cache, 'a'),
		dldr.load(loader, cache, 'b'),
		dldr.load(loader, cache, 'c'),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(items[0], 'a');
	assertEquals(items[1], 'b');
	assertEquals(items[2], 'c');
	assertEquals(cache.size, 3);
});

Deno.test('should return cached', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	const cache = new Map();

	const items = await Promise.all([
		dldr.load(loader, cache, 'a'),
		dldr.load(loader, cache, 'b'),
		dldr.load(loader, cache, 'c'),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(items[0], 'a');
	assertEquals(items[1], 'b');
	assertEquals(items[2], 'c');

	const item = await dldr.load(loader, cache, 'a');

	assertEquals(loader.callCount, 1);
	assertEquals(item, 'a');
	assertEquals(cache.size, 3);
});

Deno.test('on error should remove from cache', async () => {
	const loader = spy(async (_keys: string[]) => [new Error('error')]);

	const cache = new Map();

	dldr.load(loader, cache, 'a');
	assertEquals(cache.size, 1);

	await setImmediate();

	assertEquals(loader.callCount, 1);
	assertEquals(cache.size, 0);
});

Deno.test('cache result should be referentially equal', async () => {
	const loader = spy(async (keys: string[]) => keys.map((key) => ({ key })));

	const cache = new Map();

	const a = await dldr.load(loader, cache, 'a');
	const b = await dldr.load(loader, cache, 'a');

	assertEquals(a, { key: 'a' });
	assert(a === b);
	assertEquals(cache.size, 1);
});

Deno.test('should use different cache between loaders (default)', async () => {
	const loaderA = spy(async (keys: string[]) => keys);
	const loaderB = spy(async (keys: string[]) => keys);

	let item = await dldr.load(loaderA, undefined, 'a');

	assertEquals(loaderA.callCount, 1);
	assertEquals(loaderB.callCount, 0);
	assertEquals(item, 'a');

	item = await dldr.load(loaderA, undefined, 'a');

	assertEquals(loaderA.callCount, 1); // cached
	assertEquals(loaderB.callCount, 0);
	assertEquals(item, 'a');

	item = await dldr.load(loaderB, undefined, 'a');

	assertEquals(loaderA.callCount, 1);
	assertEquals(loaderB.callCount, 1); // different loader
	assertEquals(item, 'a');
});

Deno.test('should support non string keys', async () => {
	const loader = spy(async (keys: { x: number }[]) => keys);

	const cache = new Map();

	const items = await Promise.all([
		dldr.load(loader, cache, { x: 1 }),
		dldr.load(loader, cache, { x: 2 }),
		dldr.load(loader, cache, { x: 3 }),
		dldr.load(loader, cache, { x: 1 }),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(loader.calls[0], [[{ x: 1 }, { x: 2 }, { x: 3 }]]);
	assertEquals(items[0], { x: 1 });
	assertEquals(items[1], { x: 2 });
	assertEquals(items[2], { x: 3 });
	assertEquals(items[3], { x: 1 });
	assertEquals(cache.size, 3);
});

Deno.test('factory works', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	const l = dldr.factory(loader, new Map());

	const items = await Promise.all([l('a'), l('b'), l('c')]);

	assertEquals(loader.callCount, 1);
	assertEquals(items[0], 'a');
	assertEquals(items[1], 'b');
	assertEquals(items[2], 'c');
});
