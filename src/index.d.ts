export type LoadFn<T> = (keys: string[]) => Promise<(T | Error)[]>;

export function load<T>(loadFn: LoadFn<T>, key: string): Promise<T>;
