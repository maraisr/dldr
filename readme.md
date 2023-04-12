<div align="left">

<samp>

# dldr

</samp>

**A tiny (365B) utility for batching and caching operations**

<a href="https://npm-stat.com/charts.html?package=dldr">
  <img src="https://badgen.net/npm/dm/dldr?labelColor=black&color=black&label=npm%20downloads" alt="js downloads">
</a>
<a href="https://bundlephobia.com/result?p=dldr">
  <img src="https://badgen.net/bundlephobia/minzip/dldr?labelColor=black&color=black" alt="size">
</a>

<br />

<sup>

This is free to use software, but if you do like it, consisder supporting me ❤️

[![sponsor me](https://badgen.net/badge/icon/sponsor?icon=github&label&color=gray)](https://github.com/sponsors/maraisr)
[![buy me a coffee](https://badgen.net/badge/icon/buymeacoffee?icon=buymeacoffee&label&color=gray)](https://www.buymeacoffee.com/marais)

</sup>

</div>

## ⚙️ Install

```shell
npm add dldr
```

## 🚀 Usage

The default module will batch calls to your provided `loadFn` witin the current tick.

Under the hood we schedule a function with
[`queueMicrotask`](https://developer.mozilla.org/en-US/docs/Web/API/queueMicrotask). That then calls your `loadFn` with
the unique keys that have been requested.

```ts
import { load } from 'dldr';

// ⬇️ define some arbitary load method that accepts a single argument array of keys
const getPosts = (keys: string[]) => db.execute('SELECT id, name FROM posts WHERE id IN (?)', [keys]);

// .. for convenience, you could bind
const loadPost = load.bind(null, getPosts);

// ⬇️ demo some collection that is built up over time.
const posts = [
  load(getPosts, '123'),
  loadPost('123'), // functionally equivalent to the above
  load(getPosts, '456'),
];

// ...

posts.push(load(getPosts, '789'));

// ⬇️ batch the load calls, and wait for them to resolve
const loaded = await Promise.all(posts);

expect(getPosts).toHaveBeenCalledWith(['123', '456', '789']);
expect(loaded).toEqual([
  { id: '123', name: '123' },
  { id: '123', name: '123' },
  { id: '456', name: '456' },
  { id: '789', name: '789' },
]);
```

<details>

<summary>GraphQL Resolver Example</summary>

```ts
import { load } from 'dldr';
import { graphql, buildSchema } from 'graphql';

const schema = buildSchema(`
    type Query {
        me(name: String!): String!
    }
`);

const operation = `{
    a: me(name: "John")
    b: me(name: "Jane")
}`;

const results = await graphql({
  schema,
  source: operation,
  contextValue: {
    getUser: load.bind(null, async (names) => {
      // Assume youre calling out to a db or something
      const result = names.map((name) => name);

      // lets pretend this is a promise
      return Promise.resolve(result);
    }),
  },
  rootValue: {
    me: ({ name }, ctx) => {
      return ctx.getUser(name);
    },
  },
});
```

</details>

### Caching

Once a key has been loaded, it will be cached for all future calls.

```ts
import { load } from 'dldr/cache';
import { getPosts } from './example';

// operates the same as the above, but will cache the results of the load method

const cache = new Map();

const loadPost = load.bind(null, getPosts, cache);
// note; cache is optional, and will be created if not provided

const posts = Promise.all([
  load(getPosts, cache, '123'),
  loadPost('123'), // will be cached, and functionally equivalent to the above
  loadPost('456'),
]);

expect(getPosts).toHaveBeenCalledTimes(1);
expect(getPosts).toHaveBeenCalledWith(['123', '456']);
expect(loaded).toEqual([
  { id: '123', name: '123' },
  { id: '123', name: '123' },
  { id: '456', name: '456' },
]);

// ⬇️ the cache will be used for subsequent calls
const post = await loadPost('123');

expect(getPosts).toHaveBeenCalledTimes(1); // still once
expect(post).toEqual({ id: '123', name: '123' });
```

### API

#### Module: `dldr`

The main entry point to start batching your calls.

<!-- prettier-ignore-start -->
```ts
function load<T>(
  loadFn: (keys: string[]) => Promise<(T | Error)[]>,
  key: string
): Promise<T>;
```
<!-- prettier-ignore-end -->

> **Note** Might be worth calling `.bind` if you dont want to pass your loader everywhere.
>
> ```js
> const userLoader = load.bind(null, getUsers);
>
> await userLoader('123');
> ```

#### Module: `dldr/cache`

A submodule that will cache the results of your `loadFn` between ticks.

```ts
function load<T>(
  loadFn: (keys: string[]) => Promise<(T | Error)[]>,
  cache: MapLike<string, T> | undefined,
  key: string,
): Promise<T>;
```

> A default `Map` based `cache` will be used if you dont provide one.

**_Self managed cache_**

We explicitly do not handle mutations, so if you wish to retrieve fresh entries, or have a primed cache we recommend you
do so yourself. All we require is a `Map` like object.

Commonly an LRU cache is used, we recommend [`tmp-cache`](https://github.com/lukeed/tmp-cache).

<details>

<summary>Example</summary>

```ts
import LRU from 'tmp-cache';
import { load } from 'dldr/cache';

const loadUser = load.bind(null, getUsers, new LRU(100));
```

</details>

## 💨 Benchmark

> via the [`/bench`](/bench) directory with Node v16.20.0

```
  dldr             ~ 581,954 ops/sec ± 2.24%
★ dldr/cache       ~ 718,551 ops/sec ± 0.85%
  dataloader       ~ 301,836 ops/sec ± 2.93%
  dataloader/cache ~ 295,846 ops/sec ± 0.74%
```

## License

MIT © [Marais Rossouw](https://marais.io)
