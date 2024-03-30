import * as dldr from '../mod.ts';
import { identify } from 'object-identity';

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
