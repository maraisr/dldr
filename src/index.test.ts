import { describe, test, expect, mock } from 'bun:test';

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

test('should work', async () => {
	const loader = mock((keys: string[]) => Promise.resolve(keys));

	const items = await Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'b'),
		dldr.load(loader, 'c'),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(items[0]).toEqual('a');
	expect(items[1]).toEqual('b');
	expect(items[2]).toEqual('c');
});

test('shouldnt collect across ticks', async () => {
	const loader = mock(async (keys: string[]) => keys);

	const a = trackPromise(dldr.load(loader, 'a'));
	const b = trackPromise(dldr.load(loader, 'b'));
	const c = trackPromise(dldr.load(loader, 'c'));

	expect(a.resolved).toBeFalse();
	expect(b.resolved).toBeFalse();
	expect(c.resolved).toBeFalse();

	// @ts-ignore
	await new Promise(setImmediate);
	await new Promise(setImmediate);

	const d = trackPromise(dldr.load(loader, 'd'));

	expect(a.resolved).toBeTrue();
	expect(b.resolved).toBeTrue();
	expect(c.resolved).toBeTrue();
	expect(d.resolved).toBeFalse();

	expect(loader).toHaveBeenCalledTimes(1);
	expect(loader.mock.calls[0]).toEqual([['a', 'b', 'c']]);

	// @ts-ignore
	await new Promise(setImmediate);

	expect(d.resolved).toBeTrue();
	expect(loader).toHaveBeenCalledTimes(2);
	expect(loader.mock.calls[1]).toEqual([['d']]);
});

test('maintains call arg order', async () => {
	const loader = mock(async (keys: string[]) => keys);

	const prom = Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'b'),
		dldr.load(loader, 'c'),
	]);

	await dldr.load(loader, 'c');
	await prom;

	expect(loader).toHaveBeenCalledTimes(1);
	expect(loader.mock.calls[0]).toEqual([['a', 'b', 'c']]);
});

test('new batch once await', async () => {
	const loader = mock(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'b'),
		dldr.load(loader, 'c'),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(items[0]).toEqual('a');
	expect(items[1]).toEqual('b');
	expect(items[2]).toEqual('c');

	const items2 = await Promise.all([
		dldr.load(loader, 'd'),
		dldr.load(loader, 'e'),
	]);

	expect(loader).toHaveBeenCalledTimes(2);
	expect(loader.mock.calls[1]).toEqual([['d', 'e']]);
	expect(items2[0]).toEqual('d');
	expect(items2[1]).toEqual('e');
});

test('seperate loaders shouldnt mix', async () => {
	const loader1 = mock(async (keys: string[]) => keys);
	const loader2 = mock(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader1, 'a'),
		dldr.load(loader2, 'b'),
		dldr.load(loader1, 'c'),
	]);

	expect(loader1).toHaveBeenCalledTimes(1);
	expect(loader2).toHaveBeenCalledTimes(1);
	expect(loader1.mock.calls[0]).toEqual([['a', 'c']]);
	expect(loader2.mock.calls[0]).toEqual([['b']]);
	expect(items[0]).toEqual('a');
	expect(items[1]).toEqual('b');
	expect(items[2]).toEqual('c');
});

test('should reuse key', async () => {
	const loader = mock(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 'a'),
		dldr.load(loader, 'a'),
		dldr.load(loader, 'a'),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(loader.mock.calls[0]).toEqual([['a']]);
	expect(items[0]).toEqual('a');
	expect(items[1]).toEqual('a');
	expect(items[2]).toEqual('a');
});

test('should reuse key when not a string key', async () => {
	const loader = mock(async (keys: { x: number }[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, { x: 1 }),
		dldr.load(loader, { x: 1 }),
		dldr.load(loader, { x: 1 }),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(loader.mock.calls[0]).toEqual([[{ x: 1 }]]);
	expect(items[0]).toEqual({ x: 1 });
	expect(items[1]).toEqual({ x: 1 });
	expect(items[2]).toEqual({ x: 1 });
});

test('allow using number key type', async () => {
	const loader = mock(async (keys: number[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 1),
		dldr.load(loader, 2),
		dldr.load(loader, 3),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(loader.mock.calls[0]).toEqual([[1, 2, 3]]);
	expect(items[0]).toEqual(1);
	expect(items[1]).toEqual(2);
	expect(items[2]).toEqual(3);
});

test('allow using object key type', async () => {
	const loader = mock(async (keys: { x: number }[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, { x: 1 }),
		dldr.load(loader, { x: 2 }),
		dldr.load(loader, { x: 3 }),
	]);

	expect(loader).toHaveBeenCalledTimes(1);
	expect(loader.mock.calls[0]).toEqual([[{ x: 1 }, { x: 2 }, { x: 3 }]]);
	expect(items[0]).toEqual({ x: 1 });
	expect(items[1]).toEqual({ x: 2 });
	expect(items[2]).toEqual({ x: 3 });
});

describe('errors', () => {
	test("reject all load's promises if loader throws", async () => {
		const loader = mock(async () => {
			throw new Error('error');
		});

		const items = await Promise.all([
			safeThrow(dldr.load(loader, 'a')),
			safeThrow(dldr.load(loader, 'b')),
			safeThrow(dldr.load(loader, 'c')),
		]);

		expect(loader).toHaveBeenCalledTimes(1);
		expect(items[0].value).toEqual(null);
		expect(items[0].error).toBeInstanceOf(Error);
		expect(items[1].value).toEqual(null);
		expect(items[1].error).toBeInstanceOf(Error);
		expect(items[2].value).toEqual(null);
		expect(items[2].error).toBeInstanceOf(Error);
	});

	test('throw if values length mismatch', async () => {
		const loader = mock(async (keys: string[]) => keys.slice(0, 1));

		const items = await Promise.all([
			safeThrow(dldr.load(loader, 'a')),
			safeThrow(dldr.load(loader, 'b')),
			safeThrow(dldr.load(loader, 'c')),
		]);

		expect(loader).toHaveBeenCalledTimes(1);
		expect(loader.mock.calls[0]).toEqual([['a', 'b', 'c']]);
		expect(loader.mock.results[0].value).toBeInstanceOf(Promise);
		expect(await loader.mock.results[0].value).toEqual(['a']);

		expect(items[0].error).toBeInstanceOf(Error);
		expect(items[1].error).toBeInstanceOf(Error);
		expect(items[2].error).toBeInstanceOf(Error);
	});

	test('reject load if loader rejects that key', async () => {
		const loader = mock(async (keys: string[]) =>
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

		expect(loader).toHaveBeenCalledTimes(1);
		expect(items[0].value).toEqual('a');
		expect(items[0].error).toEqual(null);
		expect(items[1].value).toEqual(null);
		expect(items[1].error).toBeInstanceOf(Error);
		expect(items[2].value).toEqual('c');
		expect(items[2].error).toEqual(null);
	});

	test('rejects all promises for the same key', async () => {
		const loader = mock(async (keys: string[]) =>
			keys.map((key) => (key === 'a' ? new Error('error') : key)),
		);

		const items = await Promise.all([
			safeThrow(dldr.load(loader, 'a')),
			safeThrow(dldr.load(loader, 'b')),
			safeThrow(dldr.load(loader, 'a')),
		]);

		expect(loader).toHaveBeenCalledTimes(1);
		expect(items[0].error).toBeInstanceOf(Error);
		expect(items[1].value).toEqual('b');
		expect(items[1].error).toEqual(null);
		expect(items[2].error).toBeInstanceOf(Error);
	});
});

test('2 loaders nested in a .then chain', async () => {
	const loader = mock(async (keys: string[]) => keys);

	const items = await Promise.all([
		dldr.load(loader, 'a').then(() => dldr.load(loader, 'b')),
		dldr.load(loader, 'c').then(() => dldr.load(loader, 'd')),
	]);

	expect(items).toEqual(['b', 'd']);
	expect(loader).toHaveBeenCalledTimes(2);
	expect(loader.mock.calls[0]).toEqual([['a', 'c']]);
	expect(loader.mock.calls[1]).toEqual([['b', 'd']]);
});
