import { load as _load, type LoadFn } from 'dldr';
import type { MapLike } from 'dldr/cache';

const container = new WeakMap<LoadFn<any>, Map<string, Promise<any>>>();
export function load<T>(
	loadFn: LoadFn<T>,
	cache: MapLike<string, Promise<T>> | undefined,
	key: string,
): Promise<T> {
	cache ||= container.get(loadFn);
	if (!cache) container.set(loadFn, (cache = new Map()));
	if (cache.has(key)) return Promise.resolve(cache.get(key)!);
	const prom = _load(loadFn, key);
	cache.set(key, prom);
	prom.catch(() => cache!.delete(key));
	return prom;
}
