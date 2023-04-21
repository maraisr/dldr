export type LoadFn<T, K = string> = (keys: K[]) => Promise<(T | Error)[]>;

export function load<T, K = string>(loadFn: LoadFn<T>, key: K): Promise<T>;

export function factory<T, K = string>(
	loadFn: LoadFn<T, K>,
): (key: K, identity?: string | undefined) => Promise<T>;
