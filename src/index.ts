import type { LoadFn } from 'dldr';
import { identify } from 'object-identity';

type Task<T> = {
	promise: Promise<T>;
	resolve: (v: T) => void;
	reject: (e: Error) => void;
};

const batchContainer = new WeakMap<
	LoadFn<any, any>,
	{ c: Task<any>[]; r: any[]; k: string[] }
>();

export function load<T, K = string>(
	loadFn: LoadFn<T, K>,
	key: K,
	identity = identify(key),
): Promise<T> {
	let batch = batchContainer.get(loadFn);

	if (!batch) {
		batchContainer.set(loadFn, (batch = { c: [], r: [], k: [] }));

		queueMicrotask(() => {
			batchContainer.delete(loadFn);
			loadFn(batch!.r)
				.then((values) => {
					if (values.length !== batch!.r.length)
						throw new Error('loader value length mismatch');

					for (let i = 0; i < batch!.r.length; i++) {
						const value = values[i];
						const { resolve, reject } = batch!.c[i];
						if (value instanceof Error) reject(value);
						else resolve(value);
					}
				})
				.catch((error) => {
					for (let i = 0; i < batch!.r.length; i++)
						batch!.c[i].reject(error);
				});
		});
	}

	let idx = batch.k.indexOf(identity);
	if (!~idx) {
		batch.r.push(key);
		idx = batch.k.push(identity) - 1;
	}

	// @ts-expect-error we will supply this soon enough
	const p = (batch.c[idx] ||= {});
	if (p.promise) return Promise.resolve(p.promise);

	return (p.promise = new Promise<T>((resolve, reject) => {
		p.resolve = resolve;
		p.reject = reject;
	}));
}
