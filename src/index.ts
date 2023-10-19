import type { LoadFn } from 'dldr';
import { identify } from 'object-identity';

// We keep a weakly held refernce to the user provided load function,
// and batch all operations against that function.
let batchContainer = new WeakMap<LoadFn<any, any>, Batch<any, any>>();

export function load<T, K = string>(loadFn: LoadFn<T, K>, key: K, identity = identify(key)): Promise<T> {
	let batch = batchContainer.get(loadFn);

	let tasks: Task<T>[];
	let keys: K[];

	if (!batch) {
		batchContainer.set(loadFn, (batch = [[], (keys = []), (tasks = [])]));

		// Once we know we have a fresh batch, we schedule this batch to run after
		// all currently queued microtasks.
		queueMicrotask(function () {
			let tmp, i = 0;

			// As soon as we start processing this batch, we need to delete this
			// batch from our container. This is because we want to ensure that
			// any new requests for this batch will be added to a new batch.
			batchContainer.delete(loadFn);

			loadFn(keys).then(function (values) {
				if (values.length !== tasks.length)
					return reject(new Error('loader value length mismatch'));

				for (; (tmp = values[i++]), i <= values.length;
					tmp instanceof Error
						? tasks[i - 1].r(tmp)
						: tasks[i - 1].s(tmp)
				);
			}, reject);

			function reject(error: Error) {
				for (; (tmp = tasks[i++]); tmp.r(error));
			}
		});
	}

	let b = batch[0]!.indexOf(identity);
	// If the batch exists, return its promise, without enqueueing a new task.
	if (~b) return batch[2][b].p;

	let k = batch[0].push(identity) - 1;
	let t = (batch[2][k] = {} as Task<T>);
	batch[1][k] = key;

	return (t.p = new Promise<T>(function (resolve, reject) {
		t.s = resolve;
		t.r = reject;
	}));
}

export function factory<T, K = string>(loadFn: LoadFn<T, K>) {
	return function (key: K, identity?: string | undefined) {
		return load(loadFn, key, identity);
	};
}

// ---

type Task<T> = {
	p: Promise<T>;
	/** resolve */
	s(v: T): void;
	/** reject */
	r(e: Error): void;
};

type Batch<T, K> = [identies: string[], keys: K[], tasks: Task<T>[]];
