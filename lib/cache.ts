/**
 * @module
 *
 * This module provides a simple API for batching operations, and caching their results. You create a {@link LoadFn loader} function, and then use the {@link load} function to load values for a given key.
 *
 * @example
 * ```ts
 * async function loader(keys: string[]) {
 *   return keys.map(key => 'foo' + key);
 * }
 *
 * const values = await Promise.all([
 *   load(loader, 'bar'),
 *   load(loader, 'bar'),
 *   load(loader, 'baz'),
 * ]);
 *
 * expect(loader).toHaveBeenCalledWith(['bar', 'baz']);
 * console.log(values); // ['foobar', 'foobar', 'foobaz']
 *
 * const values = await Promise.all([
 *   load(loader, 'bar'),
 *   load(loader, 'baz'),
 *   load(loader, 'zig'),
 * ]);
 *
 * expect(loader).toHaveBeenCalledWith(['zig']); // bar baz have been cached
 * console.log(values); // ['foobar', 'foobaz', 'foozig']
 * ```
 */

import { identify } from 'object-identity';

import * as dldr from 'dldr';

export type MapLike<K, V> = {
	get(key: K): V | undefined;
	set(key: K, value: V): void;
	has(key: K): boolean;
	delete(key: K): void;
};

const container = new WeakMap<dldr.LoadFn<any, any>, Map<string, Promise<any>>>();

/**
 * Is identiacal to @see {@link dldr.load} but with a cache parameter. Entries that exist in this cache will be returned and not forwarded to the loader function.
 *
 * @extends dldr.LoadFn
 */
export function load<T, K = string>(
	loadFn: dldr.LoadFn<T, K>,
	cache: MapLike<string, Promise<T>> | undefined,
	key: K,
	identity: string = identify(key),
): Promise<T> {
	cache ||= container.get(loadFn);
	if (!cache) container.set(loadFn, cache = new Map());
	if (cache.has(identity)) return Promise.resolve(cache.get(identity)!);
	const prom = dldr.load(loadFn, key, identity);
	cache.set(identity, prom);
	prom.catch(() => cache!.delete(identity));
	return prom;
}

/**
 * Factory function for creating a load function that uses a cache.
 *
 * @extends dldr.LoadFn
 */
export function factory<T, K = string>(
	loadFn: dldr.LoadFn<T, K>,
	cache?: MapLike<string, Promise<T>> | undefined,
): (key: K, identity?: string | undefined) => Promise<T> {
	return (load<T, K>).bind(0, loadFn, cache);
}
