import { assertEquals, assertInstanceOf } from '@std/assert';
import { spy } from 'npm:nanospy';
import { setImmediate } from 'node:timers/promises';

import * as dldr from './mod.ts';

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

Deno.test('api', () => {
	assertInstanceOf(dldr.load, Function);
	assertInstanceOf(dldr.factory, Function);
});

Deno.test('should work', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	const items = await Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'b'),
		dldr.load(loader, 'c'),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(items[0], 'a');
	assertEquals(items[1], 'b');
	assertEquals(items[2], 'c');
});

Deno.test('shouldnt collect across ticks', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const a = trackPromise(dldr.load(loader, 'a'));
	const b = trackPromise(dldr.load(loader, 'b'));
	const c = trackPromise(dldr.load(loader, 'c'));

	assertEquals(a.resolved, false);
	assertEquals(b.resolved, false);
	assertEquals(c.resolved, false);

	await setImmediate();

	const d = trackPromise(dldr.load(loader, 'd'));

	assertEquals(a.resolved, true);
	assertEquals(b.resolved, true);
	assertEquals(c.resolved, true);
	assertEquals(d.resolved, false);

	assertEquals(loader.callCount, 1);
	assertEquals(loader.calls[0], [['a', 'b', 'c']]);

	await setImmediate();

	assertEquals(d.resolved, true);
	assertEquals(loader.callCount, 2);
	assertEquals(loader.calls[1], [['d']]);
});

Deno.test('maintains call arg order', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const prom = Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'b'),
		dldr.load(loader, 'c'),
	]);

	await dldr.load(loader, 'c');
	await prom;

	assertEquals(loader.callCount, 1);
	assertEquals(loader.calls[0], [['a', 'b', 'c']]);
});

Deno.test('new batch once await', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'b'),
		dldr.load(loader, 'c'),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(items[0], 'a');
	assertEquals(items[1], 'b');
	assertEquals(items[2], 'c');

	const items2 = await Promise.all([
		dldr.load(loader, 'd'),
		dldr.load(loader, 'e'),
	]);

	assertEquals(loader.callCount, 2);
	assertEquals(loader.calls[1], [['d', 'e']]);
	assertEquals(items2[0], 'd');
	assertEquals(items2[1], 'e');
});

Deno.test('seperate loaders shouldnt mix', async () => {
	const loader1 = spy(async (keys: string[]) => keys);
	const loader2 = spy(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader1, 'a'),
		dldr.load(loader2, 'b'),
		dldr.load(loader1, 'c'),
	]);

	assertEquals(loader1.callCount, 1);
	assertEquals(loader2.callCount, 1);
	assertEquals(loader1.calls[0], [['a', 'c']]);
	assertEquals(loader2.calls[0], [['b']]);
	assertEquals(items[0], 'a');
	assertEquals(items[1], 'b');
	assertEquals(items[2], 'c');
});

Deno.test('should reuse key', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'a'),
		dldr.load(loader, 'a'),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(loader.calls[0], [['a']]);
	assertEquals(items[0], 'a');
	assertEquals(items[1], 'a');
	assertEquals(items[2], 'a');
});

Deno.test('should reuse key when not a string key', async () => {
	const loader = spy(async (keys: { x: number }[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, { x: 1 }),
		dldr.load(loader, { x: 1 }),
		dldr.load(loader, { x: 1 }),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(loader.calls[0], [[{ x: 1 }]]);
	assertEquals(items[0], { x: 1 });
	assertEquals(items[1], { x: 1 });
	assertEquals(items[2], { x: 1 });
});

Deno.test('allow using number key type', async () => {
	const loader = spy(async (keys: number[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 1),
		dldr.load(loader, 2),
		dldr.load(loader, 3),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(loader.calls[0], [[1, 2, 3]]);
	assertEquals(items[0], 1);
	assertEquals(items[1], 2);
	assertEquals(items[2], 3);
});

Deno.test('allow using object key type', async () => {
	const loader = spy(async (keys: { x: number }[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, { x: 1 }),
		dldr.load(loader, { x: 2 }),
		dldr.load(loader, { x: 3 }),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(loader.calls[0], [[{ x: 1 }, { x: 2 }, { x: 3 }]]);
	assertEquals(items[0], { x: 1 });
	assertEquals(items[1], { x: 2 });
	assertEquals(items[2], { x: 3 });
});

Deno.test("errors :: reject all load's promises if loader throws", async () => {
	const loader = spy(async () => {
		throw new Error('error');
	});

	const items = await Promise.all([
		safeThrow(dldr.load(loader, 'a')),
		safeThrow(dldr.load(loader, 'b')),
		safeThrow(dldr.load(loader, 'c')),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(items[0].value, null);
	assertInstanceOf(items[0].error, Error);
	assertEquals(items[1].value, null);
	assertInstanceOf(items[1].error, Error);
	assertEquals(items[2].value, null);
	assertInstanceOf(items[2].error, Error);
});

Deno.test('errors :: throw if values length mismatch', async () => {
	const loader = spy(async (keys: string[]) => keys.slice(0, 1));

	const items = await Promise.all([
		safeThrow(dldr.load(loader, 'a')),
		safeThrow(dldr.load(loader, 'b')),
		safeThrow(dldr.load(loader, 'c')),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(loader.calls[0], [['a', 'b', 'c']]);
	assertInstanceOf(loader.results[0], Promise);
	assertEquals(await loader.results[0], ['a']);

	assertInstanceOf(items[0].error, TypeError);
	assertInstanceOf(items[1].error, TypeError);
	assertInstanceOf(items[2].error, TypeError);
});

Deno.test('errors :: reject load if loader rejects that key', async () => {
	const loader = spy(async (keys: string[]) =>
		keys.map((key) => {
			if (key === 'b') return new Error('error');
			return key;
		})
	);

	const items = await Promise.all([
		safeThrow(dldr.load(loader, 'a')),
		safeThrow(dldr.load(loader, 'b')),
		safeThrow(dldr.load(loader, 'c')),
	]);

	assertEquals(loader.callCount, 1);
	assertEquals(items[0].value, 'a');
	assertEquals(items[0].error, null);
	assertEquals(items[1].value, null);
	assertInstanceOf(items[1].error, Error);
	assertEquals(items[2].value, 'c');
	assertEquals(items[2].error, null);
});

Deno.test('errors :: rejects all promises for the same key', async () => {
	const loader = spy(async (keys: string[]) =>
		keys.map((key) => (key === 'a' ? new Error('error') : key))
	);

	const items = await Promise.all([
		safeThrow(dldr.load(loader, 'a')),
		safeThrow(dldr.load(loader, 'b')),
		safeThrow(dldr.load(loader, 'a')),
	]);

	assertEquals(loader.callCount, 1);
	assertInstanceOf(items[0].error, Error);
	assertEquals(items[1].value, 'b');
	assertEquals(items[1].error, null);
	assertInstanceOf(items[2].error, Error);
});

Deno.test(
	'errors :: ensure the `.catch` is ran for length mismatch',
	async () => {
		const loader = spy(async (keys: string[]) => keys.slice(0, 1));
		const e = spy((e) => e);

		const items = await Promise.all([
			dldr.load(loader, 'a').catch(e),
			dldr.load(loader, 'b').catch(e),
			dldr.load(loader, 'c').catch(e),
		]);

		assertEquals(loader.callCount, 1);
		assertEquals(loader.calls[0], [['a', 'b', 'c']]);
		assertEquals(e.callCount, 3);
		assertInstanceOf(items[0], TypeError);
	},
);

Deno.test('2 loaders nested in a .then chain', async () => {
	const loader = spy(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 'a').then(() => dldr.load(loader, 'b')),
		dldr.load(loader, 'c').then(() => dldr.load(loader, 'd')),
	]);

	assertEquals(items, ['b', 'd']);
	assertEquals(loader.callCount, 2);
	assertEquals(loader.calls[0], [['a', 'c']]);
	assertEquals(loader.calls[1], [['b', 'd']]);
});

Deno.test('factory works', async () => {
	const loader = spy((keys: string[]) => Promise.resolve(keys));

	const l = dldr.factory(loader);

	const items = await Promise.all([l('a'), l('b'), l('c')]);

	assertEquals(loader.callCount, 1);
	assertEquals(items[0], 'a');
	assertEquals(items[1], 'b');
	assertEquals(items[2], 'c');
});
