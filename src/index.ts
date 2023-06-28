import type { LoadFn } from 'dldr';
import { identify } from 'object-identity';

type Task<T> = {
	p: Promise<T>;
	s(v: T): void;
	r(e: Error): void;
};

type Batch<T, K> = Map<string, [key: K, task: Task<T>]>;

let batchContainer = new WeakMap<LoadFn<any, any>, Batch<any, any>>();

export function load<T, K = string>(
	loadFn: LoadFn<T, K>,
	key: K,
	identity: string = identify(key),
): Promise<T> {
	let batch = batchContainer.get(loadFn);

	if (!batch) {
		batchContainer.set(loadFn, (batch = new Map()));

		queueMicrotask(function () {
			batchContainer.delete(loadFn);

			let tasks: Task<T>[] = [];
			let keys: K[] = [];
			let tmp, i;
			for (tmp of batch!.values()) keys.push(tmp[0]), tasks.push(tmp[1]);

			loadFn(keys).then(function (values) {
				if (values.length !== tasks.length)
					return reject(new Error('loader value length mismatch'));

				i = 0;
				for (
					;
					(tmp = values[i++]), i <= values.length;
					tmp instanceof Error
						? tasks[i - 1].r(tmp)
						: tasks[i - 1].s(tmp)
				);
			}, reject);

			function reject(error: Error) {
				i = 0;
				for (; (tmp = tasks[i++]); tmp.r(error));
			}
		});
	}

	let b = batch.get(identity);
	if (b) return b[1].p;

	let p = {} as Task<T>;
	batch.set(identity, [key, p]);

	return (p.p = new Promise<T>(function (resolve, reject) {
		p.s = resolve;
		p.r = reject;
	}));
}

export function factory<T, K = string>(
	loadFn: LoadFn<T, K>,
): (key: K, identity?: string | undefined) => Promise<T> {
	return function (key: K, identity?: string | undefined) {
		return load(loadFn, key, identity);
	};
}
