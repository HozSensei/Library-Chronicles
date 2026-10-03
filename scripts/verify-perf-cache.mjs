#!/usr/bin/env node
import assert from 'assert';
import { createTtlCache, createLruMap } from '../src/shared/perf-cache.js';

const lru = createLruMap(2);
lru.set('a', 1);
lru.set('b', 2);
lru.set('c', 3);
assert.strictEqual(lru.has('a'), false, 'LRU évince le plus ancien');
assert.strictEqual(lru.get('b'), 2);
assert.strictEqual(lru.get('c'), 3);

const cache = createTtlCache({ maxEntries: 8, ttlMs: 50 });
let calls = 0;
const v1 = await cache.getOrLoad('k', async () => {
  calls += 1;
  return 'x';
});
const v2 = await cache.getOrLoad('k', async () => {
  calls += 1;
  return 'y';
});
assert.strictEqual(v1, 'x');
assert.strictEqual(v2, 'x');
assert.strictEqual(calls, 1, 'dedupe / TTL hit');

const p1 = cache.getOrLoad('inflight', async () => {
  await new Promise((r) => setTimeout(r, 20));
  calls += 1;
  return 42;
});
const p2 = cache.getOrLoad('inflight', async () => {
  calls += 1;
  return 99;
});
const [a, b] = await Promise.all([p1, p2]);
assert.strictEqual(a, 42);
assert.strictEqual(b, 42);
assert.strictEqual(calls, 2, 'une seule factory in-flight');

await new Promise((r) => setTimeout(r, 60));
const v3 = await cache.getOrLoad('k', async () => {
  calls += 1;
  return 'z';
});
assert.strictEqual(v3, 'z');
assert.ok(calls >= 3, 'TTL expiré → reload');

console.log('verify-perf-cache: ok');
