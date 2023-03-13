import { load as _load, type LoadFn } from 'dldr';
import type { MapLike } from 'dldr/cache';

const container = new Map();
export function load<T>(
	loadFn: LoadFn<T>,
	cache: MapLike<string, Promise<T>> | undefined,
	key: string,
): Promise<T> {
	cache ||= container;
	if (cache.has(key)) return Promise.resolve(cache.get(key)!);
	const prom = _load(loadFn, key);
	cache.set(key, prom);
	prom.catch(() => cache!.delete(key));
	return prom;
}
