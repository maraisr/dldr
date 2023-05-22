import * as dldr from '.';

declare function assert<T>(thing: T): void;

declare function loadFn<T, R = T>(keys: T[]): Promise<R[]>;

type User = { name: string };
type Comment = { text: string };

assert<Promise<string>>(dldr.load(loadFn<string>, 'test'));
assert<Promise<string>>(dldr.load(loadFn<string>, 'test', 'test'));

// @ts-expect-error
assert<Promise<string>>(dldr.load(loadFn<string>, 'test', 123));

assert<Promise<number>>(dldr.load(loadFn<number>, 123));
assert<Promise<number>>(dldr.load(loadFn<number>, 123, '123'));

assert<Promise<User>>(dldr.load(loadFn<string, User>, '1'));
// @ts-expect-error
assert<Promise<Comment>>(dldr.load(loadFn<string, User>, '1'));

// @ts-expect-error
assert<Promise<User>>(dldr.load(loadFn<string, User>, '1', 1));

assert<Promise<User>>(dldr.load(loadFn<{ id: string }, User>, { id: '123' }));

// @ts-expect-error
assert<Promise<User>>(dldr.load(loadFn<{ id: string }, User>, { id: 123 }));

assert<Promise<User>>(dldr.load(loadFn<{ id: string }, User>, { id: '123' }, '123'));

// @ts-expect-error
assert<Promise<User>>(dldr.load(loadFn<{ id: string }, User>, { id: '123' }, 123));
