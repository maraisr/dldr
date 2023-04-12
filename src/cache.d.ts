import type { LoadFn } from 'dldr';

export type MapLike<K, V> = {
	get(key: K): V | undefined;
	set(key: K, value: V): void;
	has(key: K): boolean;
	delete(key: K): void;
};

export function load<T, K = string>(
	loadFn: LoadFn<T, K>,
	cache: MapLike<string, Promise<T>> | undefined,
	key: K,
): Promise<T>;
