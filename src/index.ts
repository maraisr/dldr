import type { LoadFn } from 'dldr';
import { identify } from 'object-identity';

type Task<T> = {
	promise: Promise<T>;
	resolve(v: T): void;
	reject(e: Error): void;
};

let batchContainer = new WeakMap<
	LoadFn<any, any>,
	Map<string, [key: any, task: Task<any>]>
>();

export function load<T, K = string>(
	loadFn: LoadFn<T, K>,
	key: K,
	identity?: string | undefined,
): Promise<T> {
	let batch = batchContainer.get(loadFn);

	if (!batch) {
		batchContainer.set(loadFn, (batch = new Map()));

		queueMicrotask(function () {
			batchContainer.delete(loadFn);

			let tasks: Task<T>[] = [];
			let keys: K[] = [];
			for (let x of batch!.values()) keys.push(x[0]), tasks.push(x[1]);

			loadFn(keys)
				.then(function (values) {
					if (values.length !== tasks.length)
						throw new Error('loader value length mismatch');

					let i = values.length;
					for (; i-- > 0; ) {
						let v = values[i];
						if (v instanceof Error) tasks[i].reject(v);
						else tasks[i].resolve(v);
					}
				})
				.catch(function (error) {
					for (let task of tasks) task.reject(error);
				});
		});
	}

	identity ||= identify(key);
	let b = batch.get(identity);
	let p: Task<T>;
	if (!b) batch.set(identity, [key, (p = {} as Task<T>)]);
	else return b[1].promise;

	return (p.promise = new Promise<T>(function (resolve, reject) {
		p.resolve = resolve;
		p.reject = reject;
	}));
}
