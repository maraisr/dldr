<div align="left">

<samp>

# dldr

</samp>

**A tiny (365B) utility for batching and caching operations**

<a href="https://npm-stat.com/charts.html?package=dldr">
  <img src="https://badgen.net/npm/dm/dldr?labelColor=black&color=black&label=npm downloads" alt="js downloads"/>
</a>
<a href="https://bundlephobia.com/result?p=dldr">
  <img src="https://badgen.net/bundlephobia/minzip/dldr?labelColor=black&color=black" alt="size"/>
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

### Caching

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

expect(getPosts).toHaveBeenCalledWith(['123', '456']);
expect(loaded).toEqual([
  { id: '123', name: '123' },
  { id: '123', name: '123' },
  { id: '456', name: '456' },
]);

// ⬇️ the cache will be used for subsequent calls
const post = await loadPost('123');
expect(getPosts).toHaveBeenCalledTimes(0);
expect(post).toEqual({ id: '123', name: '123' });
```

## License

MIT © [Marais Rossouw](https://marais.io)
