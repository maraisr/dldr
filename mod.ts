import { identify } from 'object-identity';

/**
 * A loader function used to provide values for a given set of keys.
 *
 * Returning a value for a key, will resolve its associated promise, while returning an error will reject it.
 *
 * > [!WARNING]
 * > A loader function must provide a value for each key in the given set of keys.
 * > Even if this value is an error, it must be provided.
 */
export type LoadFn<T, K = string> = (keys: K[]) => Promise<(T | Error)[]>;

// We keep a weakly held refernce to the user provided load function,
// and batch all operations against that function.
let batchContainer = new WeakMap<LoadFn<any, any>, Batch<any, any>>();

/**
 * Load a value for a given key, against this loader function. We will batch against this loader function. Ensure that the loaderFn is the same reference between calls.
 *
 * @example
 * ```ts
 * async function loader(keys: string[]) {
 *   // expect keys to be ['bar', 'baz'] (deduped)
 *   return keys.map(key => 'foo' + key);
 * }
 *
 * const values = await Promise.all([
 *   load(loader, 'bar'),
 *   load(loader, 'bar'),
 *   load(loader, 'baz'),
 * ]);
 *
 * console.log(values); // ['foobar', 'foobar', 'foobaz']
 * ```
 *
 * @example Using a custom identity function
 * ```ts
 * async function loader(keys: {query, variables}[]) {
 *   return keys.map((payload) => fetch(
 *     '/graphql',
 *     { body: JSON.stringify(payload) }
 *   ));
 * }
 *
 * function load_query(query: string, variables: object) {
 *   // where request_id returns a string of the operation_id and possible `jsr:@mr/object-identity` identity`
 *   return load(loader, { query, variables }, request_id(query, variables));
 * }
 *
 * const values = await Promise.all([
 *  load_query('query { foo }', {}),
 *  load_query('query { foo }', {}),
 *  load_query('query { bar }', {}),
 * ]);
 */
export function load<T, K = string>(
	loadFn: LoadFn<T, K>,
	key: K,
	identity: string = identify(key),
): Promise<T> {
	let batch = batchContainer.get(loadFn);

	let tasks: Task<T>[];
	let keys: K[];

	if (!batch) {
		batchContainer.set(loadFn, batch = [[], keys = [], tasks = []]);

		// Once we know we have a fresh batch, we schedule this batch to run after
		// all currently queued microtasks.
		queueMicrotask(function () {
			let tmp, i = 0;

			// As soon as we start processing this batch, we need to delete this
			// batch from our container. This is because we want to ensure that
			// any new requests for this batch will be added to a new batch.
			batchContainer.delete(loadFn);

			loadFn(keys).then(function (values) {
				if (values.length !== tasks.length) {
					return reject(new TypeError('same length mismatch'));
				}

				for (
					;
					(tmp = values[i++]), i <= values.length;
					tmp instanceof Error ? tasks[i - 1].r(tmp) : tasks[i - 1].s(tmp)
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

/**
 * A convenience method to create a loader function for you, that hold's onto the stable reference of the loader function.
 *
 * @example
 * ```ts
 * const load = factory(async function loader(keys: string[]) {
 *   return keys.map(key => 'foo' + key);
 * });
 *
 * const values = await Promise.all([
 *   load('bar'),
 *   load('bar'),
 *   load('baz'),
 * ]);
 *
 * console.log(values); // ['foobar', 'foobar', 'foobaz']
 * ```
 */
export function factory<T, K = string>(
	loadFn: LoadFn<T, K>,
): (key: K, identity?: string | undefined) => Promise<T> {
	return (load<T, K>).bind(0, loadFn);
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
