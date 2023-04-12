import { load as _load, type LoadFn } from 'dldr';
import type { MapLike } from 'dldr/cache';

const container = new WeakMap<LoadFn<any, any>, Map<any, Promise<any>>>();
export function load<T, K = string>(
	loadFn: LoadFn<T, K>,
	cache: MapLike<K, Promise<T>> | undefined,
	key: K,
): Promise<T> {
	cache ||= container.get(loadFn);
	if (!cache) container.set(loadFn, (cache = new Map()));
	if (cache.has(key)) return Promise.resolve(cache.get(key)!);
	// @ts-expect-error
	const prom = _load(loadFn, key);
	cache.set(key, prom);
	prom.catch(() => cache!.delete(key));
	return prom;
}
