import { spy } from 'nanospy';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import * as dldr from './cache';

test('should work with default cache', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	// note for tests, we do pollute the global cache

	const items = await Promise.all([
		dldr.load(loader, undefined, 'a'),
		dldr.load(loader, undefined, 'b'),
		dldr.load(loader, undefined, 'c'),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(items[0], 'a');
	assert.equal(items[1], 'b');
	assert.equal(items[2], 'c');
});

test('should work for passed tests', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	const cache = new Map();

	const items = await Promise.all([
		dldr.load(loader, cache, 'a'),
		dldr.load(loader, cache, 'b'),
		dldr.load(loader, cache, 'c'),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(items[0], 'a');
	assert.equal(items[1], 'b');
	assert.equal(items[2], 'c');
	assert.equal(cache.size, 3);
});

test('should return cached', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	const cache = new Map();

	const items = await Promise.all([
		dldr.load(loader, cache, 'a'),
		dldr.load(loader, cache, 'b'),
		dldr.load(loader, cache, 'c'),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(items[0], 'a');
	assert.equal(items[1], 'b');
	assert.equal(items[2], 'c');

	const item = await dldr.load(loader, cache, 'a');

	assert.equal(loader.callCount, 1);
	assert.equal(item, 'a');
	assert.equal(cache.size, 3);
});

test('on error should remove from cache', async () => {
	const loader = spy(async (_keys: string[]) => [new Error('error')]);

	const cache = new Map();

	dldr.load(loader, cache, 'a');
	assert.equal(cache.size, 1);

	// @ts-ignore
	await new Promise(setImmediate);

	assert.equal(loader.callCount, 1);
	assert.equal(cache.size, 0);
});

test('cache result should be referentially equal', async () => {
	const loader = spy(async (keys: string[]) => keys.map((key) => ({ key })));

	const cache = new Map();

	const a = await dldr.load(loader, cache, 'a');
	const b = await dldr.load(loader, cache, 'a');

	assert.equal(a, { key: 'a' });
	assert.is(a, b);
	assert.equal(cache.size, 1);
});

test('should use different cache between loaders (default)', async () => {
	const loaderA = spy(async (keys: string[]) => keys);
	const loaderB = spy(async (keys: string[]) => keys);

	let item = await dldr.load(loaderA, undefined, 'a');

	assert.equal(loaderA.callCount, 1);
	assert.equal(loaderB.callCount, 0);
	assert.equal(item, 'a');

	item = await dldr.load(loaderA, undefined, 'a');

	assert.equal(loaderA.callCount, 1); // cached
	assert.equal(loaderB.callCount, 0);
	assert.equal(item, 'a');

	item = await dldr.load(loaderB, undefined, 'a');

	assert.equal(loaderA.callCount, 1);
	assert.equal(loaderB.callCount, 1); // different loader
	assert.equal(item, 'a');
});

test.run();
