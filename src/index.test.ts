import * as assert from 'uvu/assert';
import { test, suite } from 'uvu';
import { spy } from 'nanospy';

import * as dldr from '.';

function safeThrow<T>(promise: Promise<T>) {
	return promise.then(
		(value) => ({ value, error: null }),
		(error) => ({ value: null, error }),
	);
}

function trackPromise<T extends Promise<any>>(promise: T) {
	let resolved = false;
	let rejected = false;

	promise.then(
		() => (resolved = true),
		() => (rejected = true),
	);

	return {
		get resolved() {
			return resolved;
		},
		get rejected() {
			return rejected;
		},
	};
}

test('api', () => {
	assert.type(dldr.load, 'function');
	assert.type(dldr.factory, 'function');
});

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

test('shouldnt collect across ticks', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const a = trackPromise(dldr.load(loader, 'a'));
	const b = trackPromise(dldr.load(loader, 'b'));
	const c = trackPromise(dldr.load(loader, 'c'));

	assert.equal(a.resolved, false);
	assert.equal(b.resolved, false);
	assert.equal(c.resolved, false);

	// @ts-ignore
	await new Promise(setImmediate);

	const d = trackPromise(dldr.load(loader, 'd'));

	assert.equal(a.resolved, true);
	assert.equal(b.resolved, true);
	assert.equal(c.resolved, true);
	assert.equal(d.resolved, false);

	assert.equal(loader.callCount, 1);
	assert.equal(loader.calls[0], [['a', 'b', 'c']]);

	// @ts-ignore
	await new Promise(setImmediate);

	assert.equal(d.resolved, true);
	assert.equal(loader.callCount, 2);
	assert.equal(loader.calls[1], [['d']]);
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

test('should reuse key when not a string key', async () => {
	const loader = spy(async (keys: { x: number }[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, { x: 1 }),
		dldr.load(loader, { x: 1 }),
		dldr.load(loader, { x: 1 }),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(loader.calls[0], [[{ x: 1 }]]);
	assert.equal(items[0], { x: 1 });
	assert.equal(items[1], { x: 1 });
	assert.equal(items[2], { x: 1 });
});

test('allow using number key type', async () => {
	const loader = spy(async (keys: number[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 1),
		dldr.load(loader, 2),
		dldr.load(loader, 3),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(loader.calls[0], [[1, 2, 3]]);
	assert.equal(items[0], 1);
	assert.equal(items[1], 2);
	assert.equal(items[2], 3);
});

test('allow using object key type', async () => {
	const loader = spy(async (keys: { x: number }[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, { x: 1 }),
		dldr.load(loader, { x: 2 }),
		dldr.load(loader, { x: 3 }),
	]);

	assert.equal(loader.callCount, 1);
	assert.equal(loader.calls[0], [[{ x: 1 }, { x: 2 }, { x: 3 }]]);
	assert.equal(items[0], { x: 1 });
	assert.equal(items[1], { x: 2 });
	assert.equal(items[2], { x: 3 });
});

const errors = suite('errors');

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

	assert.instance(items[0].error, TypeError);
	assert.instance(items[1].error, TypeError);
	assert.instance(items[2].error, TypeError);
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

test('2 loaders nested in a .then chain', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 'a').then(() => dldr.load(loader, 'b')),
		dldr.load(loader, 'c').then(() => dldr.load(loader, 'd')),
	]);

	assert.equal(items, ['b', 'd']);
	assert.equal(loader.callCount, 2);
	assert.equal(loader.calls[0], [['a', 'c']]);
	assert.equal(loader.calls[1], [['b', 'd']]);
});

test('factory works', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	const l = dldr.factory(loader);

	const items = await Promise.all([l('a'), l('b'), l('c')]);

	assert.equal(loader.callCount, 1);
	assert.equal(items[0], 'a');
	assert.equal(items[1], 'b');
	assert.equal(items[2], 'c');
});

test.run();
errors.run();
