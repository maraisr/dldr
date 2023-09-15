import { expect, mock, test } from 'bun:test';

import * as dldr from './cache';

test('should work with default cache', async () => {
	const loader = mock((keys: string[]) => Promise.resolve(keys));

	// note for tests, we do pollute the global cache

	const items = await Promise.all([
		dldr.load(loader, undefined, 'a'),
		dldr.load(loader, undefined, 'b'),
		dldr.load(loader, undefined, 'c'),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(items[0]).toEqual('a');
	expect(items[1]).toEqual('b');
	expect(items[2]).toEqual('c');
});

test('should work for passed tests', async () => {
	const loader = mock((keys: string[]) => Promise.resolve(keys));

	const cache = new Map();

	const items = await Promise.all([
		dldr.load(loader, cache, 'a'),
		dldr.load(loader, cache, 'b'),
		dldr.load(loader, cache, 'c'),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(items[0]).toEqual('a');
	expect(items[1]).toEqual('b');
	expect(items[2]).toEqual('c');
	expect(cache.size).toEqual(3);
});

test('should return cached', async () => {
	const loader = mock((keys: string[]) => Promise.resolve(keys));

	const cache = new Map();

	const items = await Promise.all([
		dldr.load(loader, cache, 'a'),
		dldr.load(loader, cache, 'b'),
		dldr.load(loader, cache, 'c'),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(items[0]).toEqual('a');
	expect(items[1]).toEqual('b');
	expect(items[2]).toEqual('c');

	const item = await dldr.load(loader, cache, 'a');

	expect(loader).toHaveBeenCalledTimes(1);
	expect(item).toEqual('a');
	expect(cache.size).toEqual(3);
});

test('on error should remove from cache', async () => {
	const loader = mock(async (_keys: string[]) => [new Error('error')]);

	const cache = new Map();

	dldr.load(loader, cache, 'a');
	expect(cache.size).toEqual(1);

	// @ts-ignore
	await new Promise(setImmediate);
	await new Promise(setImmediate);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(cache.size).toEqual(0);
});

test('cache result should be referentially equal', async () => {
	const loader = mock(async (keys: string[]) => keys.map((key) => ({ key })));

	const cache = new Map();

	const a = await dldr.load(loader, cache, 'a');
	const b = await dldr.load(loader, cache, 'a');

	expect(a).toEqual({ key: 'a' });
	expect(a).toBe(b);
	expect(cache.size).toEqual(1);
});

test('should use different cache between loaders (default)', async () => {
	const loaderA = mock(async (keys: string[]) => keys);
	const loaderB = mock(async (keys: string[]) => keys);

	let item = await dldr.load(loaderA, undefined, 'a');

	expect(loaderA).toHaveBeenCalledTimes(1);
	expect(loaderB).toHaveBeenCalledTimes(0);
	expect(item).toEqual('a');

	item = await dldr.load(loaderA, undefined, 'a');

	expect(loaderA).toHaveBeenCalledTimes(1); // cached
	expect(loaderB).toHaveBeenCalledTimes(0);
	expect(item).toEqual('a');

	item = await dldr.load(loaderB, undefined, 'a');

	expect(loaderA).toHaveBeenCalledTimes(1);
	expect(loaderB).toHaveBeenCalledTimes(1); // different loader
	expect(item).toEqual('a');
});

test('should support non string keys', async () => {
	const loader = mock(async (keys: { x: number }[]) => keys);

	const cache = new Map();

	const items = await Promise.all([
		dldr.load(loader, cache, { x: 1 }),
		dldr.load(loader, cache, { x: 2 }),
		dldr.load(loader, cache, { x: 3 }),
		dldr.load(loader, cache, { x: 1 }),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(loader.mock.calls[0]).toEqual([[{ x: 1 }, { x: 2 }, { x: 3 }]]);
	expect(items[0]).toEqual({ x: 1 });
	expect(items[1]).toEqual({ x: 2 });
	expect(items[2]).toEqual({ x: 3 });
	expect(items[3]).toEqual({ x: 1 });
	expect(cache.size).toEqual(3);
});
