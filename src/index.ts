import type { LoadFn } from 'dldr';
import { identify } from 'object-identity';

// We keep a weakly held refernce to the user provided load function,
// and batch all operations against that function.
let batchContainer = new WeakMap<LoadFn<any, any>, Batch<any, any>>();

export function load<T, K = string>(
	loadFn: LoadFn<T, K>,
	key: K,
	identity: string = identify(key),
): Promise<T> {
	let batch = batchContainer.get(loadFn);

	if (!batch) {
		batchContainer.set(loadFn, (batch = new Map()));

		// Once we know we have a fresh batch, we schedule this batch to run after
		// all currently queued microtasks.
		queueMicrotask(function () {
			// As soon as we start processing this batch, we need to delete this
			// batch from our container. This is because we want to ensure that
			// any new requests for this batch will be added to a new batch.
			batchContainer.delete(loadFn);

			let tasks: Task<T>[] = [];
			let keys: K[] = [];
			let tmp, i;
			for (tmp of batch!.values()) keys.push(tmp[0]), tasks.push(tmp[1]);

			loadFn(keys).then(function (values) {
				if (values.length !== tasks.length)
					return reject(new Error('loader value length mismatch'));

				for (
					i = 0;
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
	// If the batch exists, return its promise, without enqueueing a new task.
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

// --

type Task<T> = {
	p: Promise<T>;
	/** resolve */
	s(v: T): void;
	/** reject */
	r(e: Error): void;
};

type Batch<T, K> = Map<string, [key: K, task: Task<T>]>;
