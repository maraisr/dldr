import type { LoadFn } from 'dldr';

type CB<T> = {
	promise: Promise<T>;
	resolve: (v: T) => void;
	reject: (e: Error) => void;
};

const batchContainer = new WeakMap<
	LoadFn<any, any>,
	{ cb: CB<any>[]; keys: any[] }
>();

export function load<T, K = string>(loadFn: LoadFn<T, K>, key: K): Promise<T> {
	let batch = batchContainer.get(loadFn);

	if (!batch) {
		batchContainer.set(loadFn, (batch = { cb: [], keys: [] }));

		queueMicrotask(() => {
			batchContainer.delete(loadFn);
			loadFn(batch!.keys)
				.then((values) => {
					if (values.length !== batch!.keys.length)
						throw new Error('loader value length mismatch');

					for (let i = 0; i < batch!.keys.length; i++) {
						const value = values[i];
						const { resolve, reject } = batch!.cb[i];
						if (value instanceof Error) reject(value);
						else resolve(value);
					}
				})
				.catch((error) => {
					for (let i = 0; i < batch!.keys.length; i++)
						batch!.cb[i].reject(error);
				});
		});
	}

	let idx = batch.keys.indexOf(key);
	if (!~idx) idx = batch.keys.push(key) - 1;

	// @ts-expect-error we will supply this soon enough
	const p = (batch.cb[idx] ||= {});
	if (p.promise) return Promise.resolve(p.promise);

	return (p.promise = new Promise<T>((resolve, reject) => {
		p.resolve = resolve;
		p.reject = reject;
	}));
}
