import * as assert from 'uvu/assert';
import { test, suite } from 'uvu';
import { spy } from 'nanospy';

import * as dldr from '.';

test('should work', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	const items = await Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'b'),
		dldr.load(loader, 'c'),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(items[0], 'a');
	assert.equal(items[1], 'b');
	assert.equal(items[2], 'c');
});

test('maintains call arg order', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const prom = Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'b'),
		dldr.load(loader, 'c'),
	]);

	await dldr.load(loader, 'c');
	await prom;

	assert.equal(loader.callCount, 1);
	assert.equal(loader.calls[0], [['a', 'b', 'c']]);
});

test('new batch once await', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'b'),
		dldr.load(loader, 'c'),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(items[0], 'a');
	assert.equal(items[1], 'b');
	assert.equal(items[2], 'c');

	const items2 = await Promise.all([
		dldr.load(loader, 'd'),
		dldr.load(loader, 'e'),
	]);

	assert.equal(loader.callCount, 2);
	assert.equal(loader.calls[1], [['d', 'e']]);
	assert.equal(items2[0], 'd');
	assert.equal(items2[1], 'e');
});

test('seperate loaders shouldnt mix', async () => {
	const loader1 = spy(async (keys: string[]) => keys);
	const loader2 = spy(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader1, 'a'),
		dldr.load(loader2, 'b'),
		dldr.load(loader1, 'c'),
	]);

	assert.equal(loader1.callCount, 1);
	assert.equal(loader2.callCount, 1);
	assert.equal(loader1.calls[0], [['a', 'c']]);
	assert.equal(loader2.calls[0], [['b']]);
	assert.equal(items[0], 'a');
	assert.equal(items[1], 'b');
	assert.equal(items[2], 'c');
});

test('should reuse key', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'a'),
		dldr.load(loader, 'a'),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(loader.calls[0], [['a']]);
	assert.equal(items[0], 'a');
	assert.equal(items[1], 'a');
	assert.equal(items[2], 'a');
});

const errors = suite('errors');

const safeThrow = <T>(promise: Promise<T>) =>
	promise.then(
		(value) => ({ value, error: null }),
		(error) => ({ value: null, error }),
	);

errors("reject all load's promises if loader throws", async () => {
	const loader = spy(async () => {
		throw new Error('error');
	});

	const items = await Promise.all([
		safeThrow(dldr.load(loader, 'a')),
		safeThrow(dldr.load(loader, 'b')),
		safeThrow(dldr.load(loader, 'c')),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(items[0].value, null);
	assert.instance(items[0].error, Error);
	assert.equal(items[1].value, null);
	assert.instance(items[1].error, Error);
	assert.equal(items[2].value, null);
	assert.instance(items[2].error, Error);
});

errors('throw if values length mismatch', async () => {
	const loader = spy(async (keys: string[]) => keys.slice(0, 1));

	const items = await Promise.all([
		safeThrow(dldr.load(loader, 'a')),
		safeThrow(dldr.load(loader, 'b')),
		safeThrow(dldr.load(loader, 'c')),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(loader.calls[0], [['a', 'b', 'c']]);
	assert.instance(loader.results[0], Promise);
	assert.equal(await loader.results[0], ['a']);

	assert.instance(items[0].error, Error);
	assert.instance(items[1].error, Error);
	assert.instance(items[2].error, Error);
});

errors('reject load if loader rejects that key', async () => {
	const loader = spy(async (keys: string[]) =>
		keys.map((key) => {
			if (key === 'b') return new Error('error');
			return key;
		}),
	);

	const items = await Promise.all([
		safeThrow(dldr.load(loader, 'a')),
		safeThrow(dldr.load(loader, 'b')),
		safeThrow(dldr.load(loader, 'c')),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(items[0].value, 'a');
	assert.equal(items[0].error, null);
	assert.equal(items[1].value, null);
	assert.instance(items[1].error, Error);
	assert.equal(items[2].value, 'c');
	assert.equal(items[2].error, null);
});

errors('rejects all promises for the same key', async () => {
	const loader = spy(async (keys: string[]) =>
		keys.map((key) => (key === 'a' ? new Error('error') : key)),
	);

	const items = await Promise.all([
		safeThrow(dldr.load(loader, 'a')),
		safeThrow(dldr.load(loader, 'b')),
		safeThrow(dldr.load(loader, 'a')),
	]);

	assert.equal(loader.callCount, 1);
	assert.instance(items[0].error, Error);
	assert.equal(items[1].value, 'b');
	assert.equal(items[1].error, null);
	assert.instance(items[2].error, Error);
});

test.run();
errors.run();
