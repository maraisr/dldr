import { load as _load, type LoadFn } from 'dldr';
import type { MapLike } from 'dldr/cache';
import { identify } from 'object-identity';

const container = new WeakMap<LoadFn<any, any>, Map<string, Promise<any>>>();
export function load<T, K = string>(
	loadFn: LoadFn<T, K>,
	cache: MapLike<string, Promise<T>> | undefined,
	key: K,
	identity = identify(key),
): Promise<T> {
	cache ||= container.get(loadFn);
	if (!cache) container.set(loadFn, (cache = new Map()));
	if (cache.has(identity)) return Promise.resolve(cache.get(identity)!);
	// @ts-expect-error
	const prom = _load(loadFn, key, identity);
	cache.set(identity, prom);
	prom.catch(() => cache!.delete(identity));
	return prom;
}
