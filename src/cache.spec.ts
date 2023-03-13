import { spy } from 'nanospy';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import * as dldr from './cache';

test('should work', async () => {
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

test.run();
